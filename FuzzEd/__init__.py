import os

VERSION="0.7.1"

if "DJANGO_CONFIGURATION" not in os.environ:
    print "Please set the DJANGO_CONFIGURATION environment variable to either 'Dev', 'Vagrant' or 'Production'."
    exit(-1)
