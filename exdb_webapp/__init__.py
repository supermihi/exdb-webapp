from flask import Flask, jsonify, g, render_template, redirect, request, session, url_for
from werkzeug import secure_filename
import subprocess, os, shutil
import uuid
import json

import exdb.tex, exdb.sql

app = Flask(__name__)

from functools import wraps

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
    exercises = exdb.sql.exercises(g.db)
    return render_template('list.html', exercises=exercises)

@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        users = {}
        import hashlib
        for row in g.db.execute("SELECT * FROM users"):
            users[row["user"]] = row["password"]
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
        for key in "description", "tags", "tex_preamble", "tex_exercise", "tex_solution":
            setattr(exercise, key, data[key])
        exdb.addExercise(exercise, True, connection=g.db)
        return jsonify(status="ok")
    return render_template('add.html', tags=exdb.sql.tags(g.db))

@app.route('/edit/<creator>/<int:number>', methods=["POST", "GET"])
def edit(creator, number):
    exercise = exdb.sql.exercise(creator, number)
    if request.method == "POST":
        data = json.loads(request.form["data"])
        for key in "description", "tags", "tex_preamble", "tex_exercise", "tex_solution":
            setattr(exercise, key, data[key])
        print(exercise)
        exdb.updateExercise(exercise, connection=g.db)
        return jsonify(status="ok")
    return render_template('add.html', tags=exdb.sql.tags(g.db), exercise=exercise)

@app.route('/rpclatex', methods=["POST", "GET"])
@login_required
def rpclatex():
    print(request.form)
    tex = request.form['tex']
    lang = request.form['lang']
    type = request.form['type']
    preambles = json.loads(request.form['preambles'])
    try:
        imgfile = exdb.tex.makePreview(tex, preambles=preambles, lang=lang)
        filename = secure_filename("{}_{}_{}.png".format(session['uid'], lang, type))
        staticPath = os.path.join(app.root_path, "static", filename)
        shutil.copyfile(imgfile, staticPath)
        return jsonify(status="ok", imgsrc=url_for("static", filename=filename))
    except exdb.tex.CompilationError as e:
        return jsonify(status="error", log=e.log)
    except exdb.tex.ConversionError as e:
        return jsonify(status="error", log=str(e))

@app.route('/tags')
@login_required
def tags():
    return jsonify(tags=exdb.sql.tags(g.db))
    
    
@app.before_request
def before_request():
    g.db = exdb.sql.connect()

@app.teardown_request
def teardown_request(exception):
    if hasattr(g, 'db'):
        g.db.close()