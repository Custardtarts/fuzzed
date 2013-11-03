import tempfile, os, shutil, signal, sys, ConfigParser, logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger('FuzzEd')

# Determine parameters from command line 
if len(sys.argv) != 5:
    logger.error('%s [--eps|--pdf] <working_dir> <input file> <output file>'%sys.argv[0])
    exit(-1)
kind = sys.argv[1][2:]   
working_dir = sys.argv[2] 
input_fname = sys.argv[3]
output_fname = sys.argv[4]

# Latex cannot operate well on files in another directory, so we go there directly
# This is anyway epxected to be the temporary job execution directory created by the daemon
olddir = os.getcwd()
os.chdir(working_dir)
os.rename(input_fname, 'graph.tex')
exit_code = -1
if kind == 'eps':
    os.system("latex -interaction nonstopmode graph.tex")
    if os.path.exists('graph.dvi'):
        os.system("dvips graph")
        os.system("ps2eps -R + -f -a graph.ps")
        os.rename('graph.eps', output_fname)
        exit_code = 0
elif kind == 'pdf':
    os.system("pdflatex -interaction nonstopmode graph.tex")
    if os.path.exists('graph.pdf'):
        os.rename('graph.pdf', output_fname)
        exit_code = 0

os.chdir(olddir)
exit(exit_code)