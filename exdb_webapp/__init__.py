# -*- coding: utf-8 -*-
# Copyright 2013 Michael Helmling
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License version 3 as
# published by the Free Software Foundation

import subprocess, os, shutil
from os.path import dirname, join, exists, relpath
import uuid
import json
import copy
from functools import wraps
from collections import OrderedDict

from flask import Flask, jsonify, g, render_template, redirect, request, Response, send_file, session, url_for
from werkzeug import secure_filename

import exdb.tex, exdb.sql

app = Flask(__name__)
from exdb_webapp import security
from exdb_webapp.security import login_required
from exdb_webapp import tags

def imagePath(filename):
    return url_for("static", filename="images/{}".format(filename))

app.jinja_env.globals.update(imagePath=imagePath)


@app.before_request
def before_request():
    """Connect to the SQLite database on every request."""
    g.db = exdb.sql.connect()
    if 'exdbversion' not in session:
        session['exdbversion'] = exdb.version()
        session['webappversion'] = exdb.version("exdb-webapp", dirname(__file__))


@app.teardown_request
def teardown_request(exception):
    """Close the SQLite connection after every request."""
    if hasattr(g, 'db'):
        g.db.close()


@app.route("/")
@login_required
def exerciselist():
    """The "list exercises" view (main page of the application)."""
    exercises = exdb.sql.exercises(connection=g.db)
    return render_template('list.html', exercises=exercises)


@app.route('/add', methods=["POST", "GET"])
@login_required
def add():
    if request.method == "POST":
        data = json.loads(request.form["data"])
        return jsonify(**checkSubmittedExercise(data))
    return render_template('add.html', tags=json.dumps(exdb.sql.tags(g.db)))


@app.route('/edit/<creator>/<int:number>', methods=["POST", "GET"])
@login_required
def edit(creator, number):
    exercise = exdb.sql.exercise(creator, number)
    if request.method == "POST":
        data = json.loads(request.form["data"])
        return jsonify(**checkSubmittedExercise(data, exercise))
    for typ in "exercise", "solution":
        for lang in exercise["tex_" + typ]:
            exercise["preview_" + typ + lang] = \
                url_for("preview", creator=creator, number=number, type=typ, lang=lang)
    js = exercise.toJSON().replace('\\', '\\\\').replace("'", "\\'")
    return render_template('add.html', exercise=js, tags=json.dumps(exdb.sql.tags(g.db)))


@app.route('/remove', methods=["POST"])
@login_required
def remove():
    creator = request.form['creator']
    number = int(request.form['number'])
    exdb.removeExercise(creator, number, user=session['user'])
    return jsonify(status="ok")


@app.route('/details/<creator>/<int:number>')
@login_required
def details(creator, number):
    exercise = exdb.sql.exercise(creator, number, connection=g.db)
    return render_template("details.html", exercise=exercise)


@app.route('/settings')
@login_required
def settings():
    tPath = exdb.repo.templatePath()
    template = open(join(tPath, "template.tex"), "rt").read().decode('utf-8')
    preamble = open(join(tPath, "preamble.tex"), "rt").read().decode('utf-8')
    repoUrl = exdb.repo.remoteUrl()
    return render_template("settings.html", template=template, preamble=preamble, repoUrl=repoUrl)


@app.route('/history')
@login_required
def history():
    data = exdb.repo.history()
    return render_template("history.html", entries=data)


def collectFiles(oldfiles, creator=None, number=None):
    files = []
    if len(oldfiles):
        assert creator is not None and number is not None
        files.extend(exdb.repo.loadFiles(creator, number, oldfiles))
    newfiles = request.files.getlist("datafiles")
    files.extend((secure_filename(file.filename), file.read()) for file in newfiles if file)
    return files


@app.route('/rpclatex', methods=["POST"])
@login_required
def rpclatex():
    data = json.loads(request.form["data"])
    tex = data['tex']
    lang = data['lang']
    type = data['type']
    if 'creator' in data:
        creator = data["creator"]
        number = data["number"]
    else:
        creator = number = None
    preambles = data['tex_preamble']
    files = collectFiles(data['data_files'], creator, number)
    return jsonify(**compileSnippet(tex, preambles, files, type, lang, creator, number))


def checkSubmittedExercise(data, old=None):
    """Performs validity checks on the exercise given by *data* and adds/updates it.
    
    If *old* is given an exercise update is assumed (where *old* is the old Exercise instance),
    otherwise a new exercise is created.
    *data* is a dictionary of the Exercise attributes.
    
    Returns a dictionary d, where d["status"] indicates the status and is one of:
      - "ok": in this case adding/update was successful
      - "errormsg": if validation fails; in this case d["log"] contains an error string
      - "error": TeX compilation error; in this case d["type"] contains the tex type ("solution" or
                 "exercise", d["lang"] the language, d["log"] the console output, and d["okays"]
                 is a list of TeX snippets that successfully compiled, identified by a dictionary
                 {"type":textype, "lang":language, "imgsrc":imageURL}.
    """
    description = data["description"]
    if len(description.strip()) == 0:
        return dict(status="errormsg", log="Please enter a description!")
    if len(data["tex_exercise"]) == 0:
        return dict(status="errormsg", log="Please enter exercise code in at least one language!")
    preambles = data["tex_preamble"]
    data["tags"] = [ tag for tag in data["tags"] if len(tag.strip()) > 0]
    if old:
        creator = old.creator
        number = old.number
    else:
        creator = number = None
    files = collectFiles(data['data_files'], creator, number)
    okays = []
    for type in "exercise", "solution":
        for lang, tex in data["tex_" + type].items():
            ans = compileSnippet(tex, preambles, files, type, lang, creator, number)
            if ans["status"] == "ok":
                okays.append(dict(type=type, lang=lang, imgsrc=ans["imgsrc"]))
            else:
                return dict(status="error", type=type, lang=lang, log=ans["log"], okays=okays)
    if old:
        exercise = copy.copy(old)
    else:
        exercise = exdb.exercise.Exercise(creator=session['user'])
    for key in "description", "tags", "tex_preamble", "tex_exercise", "tex_solution":
        setattr(exercise, key, data[key])
    exercise["data_files"] = [ f[0] for f in files ]
    if old:
        exdb.updateExercise(exercise, files=files, old=old, connection=g.db, user=session['user'])
    else:
        exdb.addExercise(exercise, files=files, connection=g.db)
    return dict(status="ok")


def compileSnippet(tex, preambles, files, type, lang, creator=None, number=None):
    if creator:
        exercise = exdb.sql.exercise(creator=creator, number=number)
        dct = exercise["tex_" + type]
        if lang in dct and tex == exercise["tex_" + type]:
            # no changes -> return preview URL
            return dict(status="ok",
                        imgsrc=url_for("preview",
                                       creator=creator, number=number,
                                       type=type, lang=lang)
                        )
    try:
        imgFile = exdb.tex.makePreview(tex, preambles=preambles, files=files, lang=lang)
        hashPath = os.path.split(os.path.dirname(imgFile))[1]
        return {"status": "ok", "imgsrc": url_for("tempPreview", path=hashPath)}
    except exdb.tex.CompilationError as e:
        return {"status": "error", "log": e.log.decode('utf-8', 'ignore')}
    except exdb.tex.ConversionError as e:
        return {"status": "error", "log": str(e)}


@app.route('/partial/search', methods=['POST'])
@login_required
def search():
    tags = json.loads(request.form['tags'])
    cats = json.loads(request.form['categories'])
    langs = json.loads(request.form["langs"])
    description = request.form["description"]
    pagination = json.loads(request.form["pagination"])
    num, exercises = exdb.sql.searchExercises(
                        tags=tags, cats=cats, langs=langs, description=description,
                        pagination=pagination, connection=g.db)
    return jsonify(exercises=render_template("exercises.html", exercises=exercises),
                   number=num)


@app.route('/preview/<creator>/<int:number>/<type>/<lang>')
@login_required
def preview(creator, number, type, lang):
    return send_file(join(exdb.repo.exercisePath(creator=creator, number=number),
                          "{}_{}.png".format(type, lang)))

@app.route('/datafile/<creator>/<int:number>/<filename>')
@login_required
def datafile(creator, number, filename):
    return send_file(join(exdb.repo.exercisePath(creator=creator, number=number), filename))

@app.route('/temppreview/<path>')
@login_required
def tempPreview(path):
    return send_file(join(exdb.instancePath, "previews", path, "preview.png"))
