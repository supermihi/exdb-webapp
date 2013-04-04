from flask import Flask, jsonify, request, url_for
from flask import render_template
import subprocess, os

app = Flask(__name__)

@app.route("/")
def index():
    return "Hello World!"

@app.route('/add/')
@app.route('/exercise/<id>')
def hello(id=None):
    return render_template('add.html', user="ruzika")

@app.route('/rpclatex', methods=["POST", "GET"])
def rpclatex():
    texdir = os.path.join(os.path.dirname(__file__), "static", "tex")
    with open(os.path.join(texdir, "edit.tex"), "wt") as f:
        f.write(request.form['tex'].encode('utf-8'))
    with open(os.path.join(texdir, "preamble.tex"), "wt") as f:
        for line in request.form['preamble']:
            f.write(line.encode('utf-8') + '\n')
    try:
        output = subprocess.check_output(["pdflatex", "-interaction=nonstopmode", "frame.tex"], cwd=texdir, stderr=subprocess.STDOUT)
        subprocess.check_call(["convert", "-density", "300", "frame.pdf", "frame.png"], cwd=texdir)
        return jsonify(status="ok", imgsrc=url_for("static", filename="tex/frame.png"))
    except subprocess.CalledProcessError as e:
        output = e.output
    return jsonify(status="error", log=output)

if __name__ == "__main__":
    app.debug = True
    app.run(host="0.0.0.0",port=6000)
