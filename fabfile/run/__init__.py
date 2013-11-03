from fabric.api import task
from subprocess import Popen
import sys, os

@task
def backend():
    '''Runs the backend connector daemon, who serves all configured backends.'''
    os.chdir('backends')
    backend = Popen(["python","daemon.py","daemon.ini"])
    os.chdir('..')
    if backend.returncode != None:
        print "Error %u while starting backend daemon"%backend.returncode
        exit(-1)
    print "Enter 'q' for quitting ..."
    while 1:
        line = sys.stdin.readline()
        if line.startswith('q'):
            backend.terminate()
            exit(0)

@task
def server():
    '''Runs the server.'''
    ip = None
    if os.path.exists('.vagrantip'):
        with open('.vagrantip') as f:
            ip = f.read().rstrip()
            print 'Using Vagrant IP: ' + ip
    if ip:
        os.system('./manage.py runserver %s:8000' % ip)
    else:
        os.system('./manage.py runserver')

@task
def tests():
    '''Runs all the tests.'''
    os.system('./manage.py test FuzzEd')
