#!/usr/bin/python
# -*- coding: utf-8 -*-
# Copyright 2013-2015 Michael Helmling
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License version 3 as
# published by the Free Software Foundation

from exdb_webapp import app
import logging
import exdb
import sys
import os.path

app.debug = True
app.config['SECRET_KEY'] = 'udtiarenudiatrenuditronieadtorn'
exdb.init(os.path.abspath(sys.argv[1]))
logging.basicConfig(level=logging.DEBUG)
app.run(host="0.0.0.0",port=8888)
