# -*- coding: utf-8 -*-
# Copyright 2013 Michael Helmling
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License version 3 as
# published by the Free Software Foundation

import subprocess, os, shutil
from os.path import join, exists
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


@app.teardown_request
def teardown_request(exception):
    """Close the SQLite connection after every request."""
    if hasattr(g, 'db'):
        g.db.close()


@app.route("/")
@login_required
def list():
    """The "list exercises" view (main page of the application)."""
    exercises = exdb.sql.exercises(connection=g.db)
    return render_template('list.html', exercises=exercises)


@app.route('/add', methods=["POST", "GET"])
@login_required
def add():
    if request.method == "POST":
        data = json.loads(request.form["data"])
        exercise = exdb.exercise.Exercise(creator=session['user'])
        for key in "description", "tags", "tex_preamble", "tex_exercise", "tex_solution":
            setattr(exercise, key, data[key])
        exdb.addExercise(exercise, connection=g.db)
        return jsonify(status="ok")
    return render_template('add.html')


@app.route('/edit/<creator>/<int:number>', methods=["POST", "GET"])
@login_required
def edit(creator, number):
    exercise = exdb.sql.exercise(creator, number)
    if request.method == "POST":
        copyExercise = copy.copy(exercise)
        data = json.loads(request.form["data"])
        data["tags"] = [ tag for tag in data["tags"] if len(tag.strip()) > 0]
        for key in "description", "tags", "tex_preamble", "tex_exercise", "tex_solution":
            setattr(copyExercise, key, data[key])
        exdb.updateExercise(copyExercise, old=exercise, connection=g.db, user=session['user'])
        return jsonify(status="ok")
    return render_template('add.html', exercise=exercise)


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


@app.route('/rpclatex', methods=["POST"])
@login_required
def rpclatex():
    tex = request.form['tex']
    lang = request.form['lang']
    type = request.form['type']
    if 'creator' in request.form:
        creator = request.form["creator"]
        number = request.form["number"]
        exercise = exdb.sql.exercise(creator=creator, number=number)
        dct = exercise["tex_{}".format(type)]
        if lang in dct and tex == exercise["tex_{}".format(type)]:
            return jsonify(status="ok", imgsrc=url_for("preview", creator=creator, number=number, type=type, lang=lang))
    preambles = json.loads(request.form['preambles'])
    try:
        imgfile = exdb.tex.makePreview(tex, preambles=preambles, lang=lang)
        filename = secure_filename("{}_{}_{}.png".format(session['uid'], lang, type))
        staticPath = join(app.static_folder, filename)
        shutil.copyfile(imgfile, staticPath)
        return jsonify(status="ok", imgsrc=url_for("static", filename=filename))
    except exdb.tex.CompilationError as e:
        return jsonify(status="error", log=e.log.decode('utf-8', 'ignore'))
    except exdb.tex.ConversionError as e:
        return jsonify(status="error", log=str(e))


@app.route('/partial/search', methods=['POST'])
@login_required
def search():
    tags = json.loads(request.form['tags'])
    cats = json.loads(request.form['categories'])
    langs = json.loads(request.form["langs"])
    description = request.form["description"]
    sortColumn = request.form["sortcolumn"]
    sortDirection = request.form["sortdirection"]
    exercises = exdb.sql.searchExercises(tags=tags, cats=cats, langs=langs,
                                         description=description, sortColumn=sortColumn,
                                         sortDirection=sortDirection, connection=g.db)
    return jsonify(exercises=render_template("exercises.html", exercises=exercises),
                   number=len(exercises))


@app.route('/preview/<creator>/<int:number>/<type>/<lang>')
@login_required
def preview(creator, number, type, lang):
    return send_file(join(exdb.repo.repoPath(), "exercises", "{}{}".format(creator, number),
                   "{}_{}.png".format(type, lang)))

