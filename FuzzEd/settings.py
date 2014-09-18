from configurations import Configuration, values
import os.path, logging

VERSION=0.67

PROJECT_ROOT = os.path.abspath(os.path.dirname(__file__))

AUTH_PROFILE_MODULE='FuzzEd.UserProfile'
CORS_ORIGIN_ALLOW_ALL=True
DJIKI_AUTHORIZATION_BACKEND='FuzzEd.wiki.FuzzEdWikiAccess'
DJIKI_IMAGES_PATH='wiki_img'
DJIKI_PARSER='FuzzEd.wiki'
EMAIL_HOST='localhost'
EMAIL_SUBJECT_PREFIX='[FuzzEd] '
LANGUAGE_CODE='en-en'
LOGIN_REDIRECT_URL='/dashboard/'
LOGIN_URL='/'
REQUIRE_BASE_URL='script'
REQUIRE_BUILD_PROFILE='../lib/requirejs/require_build_profile.js'
REQUIRE_JS='../lib/requirejs/require-jquery.js'
ROOT_URLCONF='FuzzEd.urls'
SECRET_KEY=values.SecretValue(environ_name='FUZZED_SECRET')
MEDIA_ROOT=''
MEDIA_URL=''
SEND_BROKEN_LINK_EMAILS=False
SERVER_EMAIL=values.Value('webmaster@fuzzed.org', environ_name='FUZZED_ADMIN_EMAIL')
ADMINS=(('FuzzEd Admin', SERVER_EMAIL),)
SITE_ID=1
STATICFILES_DIRS=('FuzzEd/static',)
STATICFILES_STORAGE='require.storage.OptimizedStaticFilesStorage'
STATIC_ROOT='FuzzEd/static-release/'
STATIC_URL='/static/'
TEST_RUNNER='django.test.runner.DiscoverRunner'
TIME_ZONE=None
USE_I18N=False
USE_L10N=True
USE_TZ=False
WSGI_APPLICATION='FuzzEd.wsgi.application'

STATICFILES_FINDERS = (
    'django.contrib.staticfiles.finders.FileSystemFinder',
    'django.contrib.staticfiles.finders.AppDirectoriesFinder',
)

TEMPLATE_LOADERS = (
    'django.template.loaders.filesystem.Loader',
    'django.template.loaders.app_directories.Loader',
)

TEMPLATE_CONTEXT_PROCESSORS = (
    'django.core.context_processors.static',
    'django.contrib.auth.context_processors.auth',
    'django.contrib.messages.context_processors.messages'
)

MIDDLEWARE_CLASSES = (
    'django.middleware.common.CommonMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    #Uncomment the next line for simple clickjacking protection:
    #'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'FuzzEd.middleware.HttpErrorMiddleware', 
    'corsheaders.middleware.CorsMiddleware', 
    'oauth2_provider.middleware.OAuth2TokenMiddleware'
)

INSTALLED_APPS = (
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.admin',
    'django.contrib.admindocs',
    'openid2rp.django',
    'require',
    'oauth2_provider',
    'corsheaders',
    'tastypie', 
    'djiki', 
    'FuzzEd'
)


AUTHENTICATION_BACKENDS = (
    'django.contrib.auth.backends.ModelBackend',
    'oauth2_provider.backends.OAuth2Backend', 
    'openid2rp.django.auth.Backend'
)


LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'filters': {
        'require_debug_false': {
            '()': 'django.utils.log.RequireDebugFalse'
        }
    },
    'handlers': {
        'console': {
            'level':   'DEBUG',
            'class':   'logging.StreamHandler'
        },
        'mail_admins': {
            'level':   'ERROR',
            'class':   'django.utils.log.AdminEmailHandler',
            'filters': ['require_debug_false'],
        }, 
        'file':{
            'level': 'DEBUG',
            'class': 'logging.FileHandler',
            'filename': '/tmp/fuzzed.log',
        },               
        'False': {
            'level': 'DEBUG',
            'class': 'logging.NullHandler',
        },
    },
    'loggers': {
        'django.request': {
            'handlers':  ['console'],
            'level':     'ERROR',
            'propagate': True,
        },
        'FuzzEd': {
            'handlers':  ['console'],
            'level':     'DEBUG',
            'propagate': True,
        }
    }
}

class Dev(Configuration):
    DEBUG = True
    TEMPLATE_DEBUG = True
    DATABASES = {
        'default': {
            'ENGINE':   'django.db.backends.sqlite3', 
            'NAME':     'fuzztrees.sqlite',  
            'TEST_NAME':'test_fuzztrees.sqlite',                      
            'USER':     'fuzztrees.sqlite',                              
            'PASSWORD': 'fuzztrees',                       
            'HOST':     'localhost',                                       
            'PORT':     '',                                       
        }
    }
    EMAIL_BACKEND  = 'django.core.mail.backends.console.EmailBackend'
    SERVER         = 'http://localhost:8000'
    OPENID_RETURN  = SERVER+'/login/?openidreturn'
    TEMPLATE_DIRS  = ('FuzzEd/templates', 
                      'FuzzEd/static/img', 
                      'FuzzEd/templates/djiki', 
                      'djiki')
    BACKEND_DAEMON = "http://localhost:8000"

class VagrantDev(Dev):
    SERVER        = 'http://192.168.33.10:8000'
    OPENID_RETURN = 'http://192.168.33.10:8000/login/?openidreturn'

class Production(Configuration):
    DEBUG = False
    TEMPLATE_DEBUG = False
    DATABASES = {
        'default': {
            'ENGINE':   'django.db.backends.postgresql_psycopg2', 
            'NAME':     values.Value('fuzzed', 
                                    environ_name='FUZZED_DB_NAME'),  
            'USER':     values.Value('fuzzed', 
                                    environ_name='FUZZED_DB_USER'),                               
            'PASSWORD': values.Value('fuzzed', 
                                    environ_name='FUZZED_DB_PW'),                       
            'HOST':     values.Value('localhost', 
                                    environ_name='FUZZED_DB_HOST'),                                       
            'PORT':     values.Value('', 
                                    environ_name='FUZZED_DB_PORT'),                                       
        }
    }
    EMAIL_BACKEND  = 'django.core.mail.backends.smtp.EmailBackend'
    ALLOWED_HOSTS  = [values.Value('fuzzed.org', 
                                    environ_name='FUZZED_HOST_NAME')] 
    SERVER         = 'https://' + values.Value('fuzzed.org', 
                                    environ_name='FUZZED_HOST_NAME')    
    OPENID_RETURN  = SERVER+'/login/?openidreturn'
    TEMPLATE_DIRS  = (PROJECT_ROOT+'/templates',
                      PROJECT_ROOT+'/static-release/img',
                      PROJECT_ROOT+'/templates/djiki')
    LOGGING = Configuration.LOGGING    
    LOGGING['loggers']['django.request']['handlers']=['mail_admins']
    LOGGING['loggers']['FuzzEd']['handlers']        =['file']
    BACKEND_DAEMON = values.Value('http://backend.fuzzed.org:8000', 
                                    environ_name='FUZZED_BACKEND_HOST_NAME')
