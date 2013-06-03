from django.core.management.base import BaseCommand
from FuzzEd.models import Graph
import tempfile, os

class Command(BaseCommand):
    args = '<graph_id>'
    help = 'Dumps the graph with the given ID into PDF, through TIKZ / Latex'

    def handle(self, *args, **options):
        graph_id = int(args[0])
        graph = Graph.objects.get(pk=graph_id)

        print('Dumping graph %d' % (graph_id))
        text = graph.to_tikz()
        f = tempfile.NamedTemporaryFile(delete=False)
        name = f.name
        f.write(text)
        f.close()
        os.system("pdflatex "+f.name)
        os.remove(name)
        print name+".pdf"
