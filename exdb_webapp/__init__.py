from flask import Flask, jsonify, g, render_template, redirect, request, session, url_for
import subprocess, os, shutil

import exdb.tex, exdb.sql

app = Flask(__name__)

from functools import wraps

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
            return redirect(url_for("list"))
    return render_template('login.html', error=error)

@app.route('/logout')
def logout():
    session.pop('user', None)
    return redirect(url_for('login'))

@app.route('/add')
@login_required
def add(id=None):
    return render_template('add.html')

@app.route('/rpclatex', methods=["POST", "GET"])
@login_required
def rpclatex():
    tex = request.form['tex'].encode('utf-8')
    imgfile = exdb.tex.makePreview(tex)
    staticPath = os.path.join(app.root_path, "static", "preview.png")
    shutil.copyfile(imgfile, staticPath)
    return jsonify(status="ok", imgsrc=url_for("static", filename="preview.png"))
    
    return jsonify(status="error", log=output)

@app.before_request
def before_request():
    g.db = exdb.sql.connect()

@app.teardown_request
def teardown_request(exception):
    if hasattr(g, 'db'):
        g.db.close()