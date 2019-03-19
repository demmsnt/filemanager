#!/usr/bin/python3.5
"""Генератор HashBang для W shop
start
start-stop-daemon --start -b --pidfile hashbang.pid -d /home/dem/projects/wshop3/qooxdoo-5.0.2-sdk/wshop/bot_backend --exec ./srv.py
stop
start-stop-daemon --stop --pidfile ./hashbang.pid
"""
import re
import os
import csv
import sys
import json
import urllib
import jinja2
import shutil
import hashlib
import logging
import os.path
import asyncio
import humanize
import datetime
import mimetypes
import traceback
import aiohttp_jinja2
from aiohttp import web
from pprint import pprint
from decimal import Decimal
from urllib.parse import unquote, quote
from aiohttp.web_exceptions import HTTPNotFound, HTTPForbidden
from os.path import abspath, join as pjoin, isdir, basename, dirname

from cfg import *


# ------------------------------------------------------------------------------------
# Файловый менеджер
# ------------------------------------------------------------------------------------

def normalizePath(path, cfg):
    root = cfg['root']
    full_root = abspath(root)
    if path == '/':
        return full_root
    fullpath = abspath(pjoin(full_root, './'+path))
    if not fullpath.startswith(full_root):
        raise HTTPForbidden
    return fullpath


def subpath(path, cfg):
    root = cfg['root']
    full_root = abspath(root)
    result = path[len(full_root):]
    if result[0]!='/':
        result = '/' + result
    return result


def ls(path, cfg):
    result = {
        'path': path,
        'dirs': [],
        'files': []
        }
    fs_path = normalizePath(path, cfg)
    url_root = cfg.get('url_root', None)
    for fname in os.listdir(fs_path):
        fs_fullname = pjoin(fs_path, fname)
        fullname = pjoin(path, fname)
        obj = {
            'name': fname,
            'fullname': fullname
            }
        if isdir(fs_fullname):
            obj['mime'] = 'folder'
            obj['size'] = 0
            obj['s_size'] = 0
            result['dirs'].append(obj)
        else:
            mime = mimetypes.guess_type(fname)[0]
            obj['mime'] = mime
            obj['size'] = os.path.getsize(fs_fullname)
            obj['s_size'] = humanize.naturalsize(obj['size'])
            if url_root:
                obj['url'] = url_root+fullname
            result['files'].append(obj)
    return result

async def upload(path, rqdata, cfg):
    f = rqdata["file"]
    filename = f.filename
    fs_path = normalizePath(os.path.join(path, filename), cfg)
    open(fs_path, "wb").write(f.file.read())  # TODO Большие файлы


def rm(path, cfg):
    fs_path = normalizePath(path, cfg)
    if isdir(fs_path):
        shutil.rmtree(fs_path)
    else:
        os.remove(fs_path)


def mkdir(path, cfg):
    fs_path = normalizePath(path, cfg)
    os.mkdir(fs_path)


def mv(path, cfg):
    fs_path_from = normalizePath(path[0], cfg)
    fs_path_to = normalizePath(path[1], cfg)
    if isdir(fs_path_from):
        shutil.move(fs_path_from, fs_path_to)
    else:
        shutil.move(fs_path_from, fs_path_to)

def cp(path, cfg):
    fs_path_from = normalizePath(path[0], cfg)
    fs_path_to = normalizePath(path[1], cfg)
    if isdir(fs_path_from):
        fs_path_to = pjoin(fs_path_to, basename(fs_path_from))
        shutil.copytree(fs_path_from, fs_path_to)
    else:
        shutil.copy2(fs_path_from, fs_path_to)

def pack(path, cfg):
    fs_path = normalizePath(path, cfg)
    cmd = "zip -r {} {}".format(fs_path, fs_path)
    os.system(cmd)


def unpack(path, cfg):
    fs_path = normalizePath(path, cfg)
    os.chdir(dirname(fs_path))
    os.system("unzip '{}'".format(basename(fs_path)))


def download(path, cfg):
    fs_path = normalizePath(path, cfg)
    mime = mimetypes.guess_type(fs_path)[0]
    mime = 'application/octet-stream' if mime is None else mime
    # TODO стримить
    resp =  web.Response(
                        body=open(fs_path, 'rb').read(),
                        content_type=mime,
                        headers=[('Content-Disposition', 'attachment; filename="'+quote(basename(path))+'"')]
                        )
    return resp

async def filemanager(request):
    result = '{"status": "error", "message": "bad command"}'
    config = FILEMANAGER.get(request.path, None)
    if config:
        rqdata = await request.post()
        #print('>>>>>>>>>>>', dir(request), rqdata)
        #data = json.loads(request.POST['data'])
        data = json.loads(rqdata['data'])
        if DEBUG:
            pprint(("json=", data))
        print('>>>>>>>>>', data, type(data))
        command = data['command']
        if command['command'] == 'login':
            result = json.dumps({'status': 'error',
                                 'message': 'bad username or password'
                                 })
            if command['login'] in config['users']\
               and config['users'][command['login']]['password'] == command['password']:
                result = json.dumps({'status': 'Ok'})
        else:
            current_dir = os.getcwd()
            try:
                if config['users'].get(data['login'], {'password': None})['password'] != data['password']:
                    raise HTTPForbidden
                if command['command'] == 'ls':
                    result = json.dumps({'status': 'Ok',
                                         'result': ls(command['path'], config)
                                         })
                elif command['command'] == 'download':
                    return download(command['path'], config)

                elif command['command'] == 'upload':
                    await upload(command['path'], rqdata, config)
                    result = json.dumps({'status': 'Ok'})
                elif command['command'] == 'rm':
                    rm(command['path'], config)
                    result = json.dumps({'status': 'Ok'})
                elif command['command'] == 'mkdir':
                    mkdir(command['path'], config)
                    result = json.dumps({'status': 'Ok'})
                elif command['command'] == 'unpack':
                    unpack(command['path'], config)
                    result = json.dumps({'status': 'Ok'})
                elif command['command'] == 'mv':
                    mv(command['path'], config)
                    result = json.dumps({'status': 'Ok'})
                elif command['command'] == 'cp':
                    cp(command['path'], config)
                    result = json.dumps({'status': 'Ok'})
                elif command['command'] == 'pack':
                    pack(command['path'], config)
                    result = json.dumps({'status': 'Ok'})
                else:
                    result = json.dumps({'status': 'error',
                                         'message': 'bad command'
                                         })
            except:
                result = json.dumps({'status': 'error',
                                     'message': str(traceback.format_exc())
                                     })
            os.chdir(current_dir)


    else:
        result = '{"status": "error", "message": "bad config path"}'
    print("request.path", request.path)
    return web.Response(
                        body=str.encode(result),
                        content_type='application/json'
                        )

def init(argv):
    """ use:
    python3 -m aiohttp.web -H localhost -P 8090 srv:init
    or
    python3 -m aiohttp.web -H localhost -P 8090 srv:init debug
    """
    app = web.Application()
    if 'debug' in argv:
        app.router.add_static('/static/',
                              path=STATIC_ROOT,
                              name='static')
    if 'debug' in argv:
        app.router.add_static('/data/',
                              path='./data',
                              name='data')
    app.router.add_post('/__filemanager/{tail:.*}', filemanager)
    return app

if __name__ == '__main__':
    # save pid
    open('hashbang.pid', 'w').write(str(os.getpid()))
    loop = asyncio.get_event_loop()
    app = init(sys.argv)
    web.run_app(app, host='0.0.0.0', port=8000)
    #print(init.__doc__)

