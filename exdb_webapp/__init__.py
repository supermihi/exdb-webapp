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
from functools import wraps

from flask import Flask, jsonify, g, render_template, redirect, request, send_file, session, url_for
from werkzeug import secure_filename

import exdb.tex, exdb.sql


app = Flask(__name__)


def imagePath(filename):
    return url_for("static", filename="images/{}".format(filename))

app.jinja_env.globals.update(imagePath=imagePath)

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if session.get("user") is None:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

@app.route("/")
@login_required
def list():
    exercises = exdb.sql.exercises(connection=g.db)
    return render_template('list.html', exercises=exercises, tags=exdb.sql.tags(g.db))

@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        users = {}
        import hashlib
        with open(join(exdb.instancePath, 'users.txt'), "rt") as userFile:
            for line in userFile:
                user, hash = line.strip().split("|", 1)
                users[user] = hash
        user = request.form["username"]
        if user not in users:
            error = "Invalid username"
        elif hashlib.sha256(request.form["password"]).hexdigest() != users[user]:
            error = "Invalid password"
        else:
            session['user'] = user
            session['uid'] = uuid.uuid4()
            return redirect(url_for("list"))
    return render_template('login.html', error=error)

@app.route('/logout')
def logout():
    session.pop('user', None)
    return redirect(url_for('login'))

@app.route('/add', methods=["POST", "GET"])
@login_required
def add():
    if request.method == "POST":
        data = json.loads(request.form["data"])
        exercise = exdb.exercise.Exercise(creator=session['user'])
        data["tags"] = [ tag for tag in data["tags"] if len(tag.strip()) > 0]
        for key in "description", "tags", "tex_preamble", "tex_exercise", "tex_solution":
            setattr(exercise, key, data[key])
        exdb.addExercise(exercise, connection=g.db)
        return jsonify(status="ok")
    return render_template('add.html', tags=json.dumps(exdb.sql.tags(g.db), ensure_ascii="False"))

@app.route('/edit/<creator>/<int:number>', methods=["POST", "GET"])
@login_required
def edit(creator, number):
    exercise = exdb.sql.exercise(creator, number)
    if request.method == "POST":
        data = json.loads(request.form["data"])
        for key in "description", "tags", "tex_preamble", "tex_exercise", "tex_solution":
            setattr(exercise, key, data[key])
        exdb.updateExercise(exercise, connection=g.db, user=session['user'])
        return jsonify(status="ok")
    return render_template('add.html', tags=json.dumps(exdb.sql.tags(g.db), ensure_ascii="False"), exercise=exercise)

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

@app.route('/partial/tagfilters')
@login_required
def tagfilters():
    tags = exdb.sql.tags(g.db)
    return render_template("tagfilters.html", tags=tags)

@app.route('/partial/search', methods=['POST'])
@login_required
def search():
    tags = json.loads(request.form['tags'])
    langs = json.loads(request.form["langs"])
    exercises = exdb.sql.searchExercises(tags=tags, langs=langs, connection=g.db)
    return render_template("exercises.html", exercises=exercises)

@app.before_request
def before_request():
    g.db = exdb.sql.connect()

@app.route('/preview/<creator>/<int:number>/<type>/<lang>')
@login_required
def preview(creator, number, type, lang):
    print(exdb.repo.repoPath())
    return send_file(join(exdb.repo.repoPath(), "exercises", "{}{}".format(creator, number),
                   "{}_{}.png".format(type, lang)))

@app.teardown_request
def teardown_request(exception):
    if hasattr(g, 'db'):
        g.db.close()