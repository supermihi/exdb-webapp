#!/usr/bin/python2
# -*- coding: utf-8 -*-
# Copyright 2013 Michael Helmling
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License version 3 as
# published by the Free Software Foundation

from exdb_webapp import app
import exdb
import sys

app.debug = True
app.config['SECRET_KEY'] = 'udtiarenudiatrenuditronieadtorn'
exdb.init(sys.argv[1])
app.run(host="0.0.0.0",port=6000)