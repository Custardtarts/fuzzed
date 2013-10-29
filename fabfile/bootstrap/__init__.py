from fabric.api import task
import cuisine
import platform, os, urllib
cuisine.mode_local()

@task 
def dev():
    '''Installs all software needed to make the machine a development machine.'''

    # Install Python packages, independent from OS
    print "Installing Python packages..."
    for package in ["django", "south", "openid2rp", "django-require", "pyxb", "django-less", "poster"]:
        print "Installing "+package
        cuisine.python_package_ensure(package)        

    # Install native packages, independent from OS
    print "Checking and installing native packages ..."
    for p in ["cmake","npm","boost","xerces-c"]:
        print "Installing "+p
        cuisine.package_ensure(p)

    # Install native packages, dependent on OS
    if platform.system() != 'Darwin':
        # Install native packages on Linux
        for p in ["postgresql", "texlive", "libxerces-c-dev", "libboost1.48-all-dev", "xsdcxx", "python-psycopg2"]:
            print p
            cuisine.package_ensure(p)
    else:
        # Perform latest GCC installation on Homebrew
        print "Installing latest GCC"
        cuisine.run("brew tap homebrew/versions")
        # We had issues. It helped. Don't ask.
        cuisine.run("brew tap --repair")
        cuisine.package_ensure("gcc49") # if you mess around with this, you also need to fix the CMAKE configuration
        # Install native packages on Darwin
        print "Installing Postgres"
        cuisine.package_ensure("postgres")
        # check if Latex is installed
        print "Checking for dvips"
        output = cuisine.run('dvips')
        if 'command not found' in output:
            raise Exception('We need a working Latex for the rendering server. Please install it manually.')

    # Installing less via npm: no brew on Darwin, too old in Linux apt
    print "Installing lessc"
    output = cuisine.run('lessc')
    if 'command not found' in output:
        cuisine.sudo("npm install -g less")
        cuisine.sudo("ln -s /usr/local/share/npm/bin/lessc /usr/local/bin/lessc")

    # There is no brew for this XSD compiler
    # Fetch binary installation package for the XSD compiler, install the package
    print "Installing CodeSynthesis XSD"
    if not os.path.exists("/tmp/xsd-3.3.0.tar.bz2"):
        print "Fetching XSD compiler from the web ..."
        urllib.urlretrieve("http://www.codesynthesis.com/download/xsd/3.3/macosx/i686/xsd-3.3.0-i686-macosx.tar.bz2","/tmp/xsd-3.3.0.tar.bz2")
    else:
        print "Using existing XSD compiler download from /tmp/ ..."           
    cuisine.run("tar xvzf /tmp/xsd-3.3.0.tar.bz2 -C /tmp")
    cuisine.run("mv /tmp/xsd-3.3.0-i686-macosx tools/xsdcompile")

    # Postgres installation, including database creation
    print "Configuring and starting PostgreSQL ..."
    os.system('cp fabfile/bootstrap/sql.txt /tmp/')
    if platform.system() == "Darwin":
        cuisine.run('initdb /usr/local/var/postgres -E utf8')                                           # Initialize system database
        cuisine.run('ln -sfv /usr/local/opt/postgresql/*.plist ~/Library/LaunchAgents')                 # Enable autostart  
        cuisine.run('launchctl load ~/Library/LaunchAgents/homebrew.mxcl.postgresql.plist')             # Start it now
        cuisine.run('/usr/local/bin/psql -f /tmp/sql.txt postgres')
    else:
        cuisine.run('sudo su - postgres -c \"psql -f /tmp/sql.txt postgres\"')    
    print "Performing complete build to get loadable Django project code"
    os.system("fab build.all")
    print "Initializing and syncing local database ..."
    os.system('./manage.py syncdb --noinput --no-initial-data --migrate')
    
@task 
def web():
    '''Installs all software needed to make the machine a web server machine.'''
    for package in ["django", "south", "openid2rp", "pyxb", "django-less"]:
        cuisine.python_package_ensure(package)        
    cuisine.package_ensure("apache2")
    cuisine.package_ensure("libapache2-mod-wsgi")
    cuisine.package_ensure("postgresql")
    cuisine.package_ensure("python-psycopg2")
    #TODO: Prepare database
    #TODO: Prepare Apache config
    #    Install new release on production web server
    #    --------------------------------------------
    #    > sudo puppet apply install/prod_web.pp
    #    > tar xvfz FuzzEd-x.x.x.tar.gz /var/www/fuzztrees.net/
    #    > ln -s /var/www/fuzztrees.net/FuzzEd-x.x.x /var/www/fuzztrees.net/www
    #    > service apache2 restart


@task 
def backend():
    '''Installs all software needed to make the machine a backend machine.'''
    for package in ["pyxb","poster"]:
        cuisine.python_package_ensure(package)        
    if platform.system() != 'Darwin':
        cuisine.package_ensure("texlive")
    else:
        # check if latex is installed
        if not cmd_exists("latex"):
            raise Exception('We need a working Latex for the rendering server. Please install it manually.')
    #    Installation of production backend server
    #    -----------------------------------------
    #    > sudo puppet apply install/prod_backend.pp
    #    > tar xvfz FuzzEdAnalysis-x.x.x.tar.gz /home/fuzztrees
    #    > ln -s /home/fuzztrees/FuzzEdAnalysis-x.x.x /home/fuzztrees/analysis 
    #    > ln -s /home/fuzztrees/analysis/initscript /etc/init.d/fuzzTreesAnalysis
    #    > tar xvfz FuzzEdRendering-x.x.x.tar.gz /home/fuzztrees
    #    > ln -s /home/fuzztrees/FuzzEdRendering-x.x.x /home/fuzztrees/rendering 
    #    > ln -s /home/fuzztrees/rendering/initscript /etc/init.d/fuzzTreesRendering##
