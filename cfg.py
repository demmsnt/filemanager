import logging

DEBUG = True
LOGFILE = None
#LOGFILE='./srv.log'
LOGLEVEL = logging.DEBUG
LOGFORMAT = u'%(levelname)-8s [%(asctime)s] %(message)s'

STATIC_ROOT = './static'

FILEMANAGER = {
    '/__filemanager/test': {
        'users': {
            'user': {
                'password': 'e10adc3949ba59abbe56e057f20f883e'
            }
        },
        'root': '/home/dem/projects/fm/fm/data',
        'url_root': '/data'
    }
}
