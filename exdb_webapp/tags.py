# -*- coding: utf-8 -*-
# Copyright 2013 Michael Helmling
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License version 3 as
# published by the Free Software Foundation

"""This module contains the views and AJAX handers for the tag tree."""

from flask import jsonify, g, render_template, request, Response, session

import exdb.tags 

from . import app
from .security import login_required


@app.route('/partial/tagtree', methods=['GET', 'POST'])
@login_required
def tagtree():
    if request.method == 'GET':
        tree = exdb.tags.readTreeFromTable(g.db)
        return Response(exdb.tags.toJSON(tree), mimetype='application/json')
    return jsonify(status="ok")


@app.route('/tags', methods=['GET', 'POST'])
@login_required
def tags():
    if request.method == 'GET':
        return render_template('tags.html')
    oldtree = exdb.tags.readTreeFromTable(g.db)
    newtree = exdb.tags.fromJSON(request.form['tree'])
    if exdb.updateTagTree(oldtree, newtree, user=session.get("user"), connection=g.db):
        return jsonify(status="ok")
    else:
        return jsonify(status="unchanged")