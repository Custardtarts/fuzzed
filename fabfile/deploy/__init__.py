from fabric.api import task, env, roles
from fabfile.common import version
from fabfile import bootstrap
from fabric.operations import put, run, sudo
import os.path
import os

env.roledefs['web'] = ['root@web.netclients-services.de']
env.roledefs['backend'] = ['root@web.netclients-services.de']

@task
@roles('web')
def web():
    '''Performs deployment of the local packaging result on the web servers.'''
    package = "FuzzEd-"+version+".tar.gz"
    assert(os.path.isfile('dist/'+package))
    # TODO: Use bootstrap scripts for then, when they work in fabric mode
    # # Prepare environment on target machine
    # print "Preparing basic environment"
    # #sudo("apt-get update")
    # sudo('apt-get install apache2')	# already here for having /var/www
    # sudo('apt-get install gcc autoconf python python-dev python-pip')
    # sudo('pip install fabric')
    # Put release package
    print "Uploading "+package
    put('dist/'+package, '/var/www/')
    run('tar xvfz /var/www/fuzztrees.net/'+package+" -C /var/www/fuzztrees.net/")
    print "Setting directory softlink"
    run('ln -fs /var/www/fuzztrees.net/FuzzEd-'+version+' /var/www/fuzztrees.net/www')
    sudo('pg_dump fuzztrees > /tmp/fuzztrees.sql')
    run('cd /var/www/fuzztrees.net/www/; ./manage.py syncdb --migrate')
    sudo('apache2ctl configtest')
    sudo('service apache2 restart')

@task
@roles('backend')
def backend():
    ''' Performs deployment of the local packaging result on the backend server.'''
    package = "FuzzEdBackend-"+version+".tar.gz"
    assert(os.path.isfile('dist/'+package))
    print "Uploading "+package
    sudo('mkdir -p /usr/local/fuzzed')
    put('dist/'+package, '/usr/local/fuzzed/')
    run('tar xvfz /usr/local/fuzzed/'+package+' -C /usr/local/fuzzed/')
    run('ln -fs /usr/local/fuzzed/FuzzEdBackend-'+version+' /usr/local/fuzzed/FuzzEdBackend')
    sudo('ln -fs /usr/local/fuzzed/FuzzEdBackend/initscript.sh /etc/init.d/fuzzed-backend')
    sudo('chmod u+x /etc/init.d/fuzzed-backend')
    sudo('service fuzzed-backend start')

