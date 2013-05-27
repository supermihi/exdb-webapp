#!/usr/bin/python2
# -*- coding: utf-8 -*-
# Copyright 2013 Michael Helmling
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License version 3 as
# published by the Free Software Foundation

from setuptools import setup, find_packages

setup(name='exdb-webapp',
      version='0.2.1',
      description='A flask-driven web application to manage an exdb exercise database',
      author='Michael Helmling',
      author_email='michaelhelmling@posteo.de',
      url='http://github.com/supermihi/exdb-webapp',
      license='GPL3',
      packages=find_packages(),
      include_package_data=True,
      install_requires=["flask"],
    )
