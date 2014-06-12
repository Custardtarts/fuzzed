from django.contrib.auth.models import User
from django.db import models
from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.core.urlresolvers import reverse

from graph import Graph
from FuzzEd.lib.jsonfield import JSONField

import json

class Result(models.Model):
    """
      Class: Project

      Each instance represents a particular backend result.
      On analysis / simulation, both graph-related and configuration-related
      issues are detected. In order to separate them, there is a dedicated
      'Result' kind for graph-related issues. Result objects are created by
      the Job class when the backend computation results return.
      
      Fields:
       {Configuration}   configuration  -
       {Graph}           graph          -
       {str}             kind           -
       {JSON}            value          -
       {int}             value_sort     - 
       {JSON}            node_issues    -
                             
    """
  
    class Meta:
        app_label = 'FuzzEd'

    ANALYSIS_RESULT   = 'T'
    SIMULATION_RESULT = 'S'
    MINCUT_RESULT     = 'M'
    PDF_RESULT        = 'P'
    EPS_RESULT        = 'E'
    GRAPH_ISSUES      = 'G'
    RESULT_TYPES = [ (GRAPH_ISSUES, 'graphissues'), 
                     (SIMULATION_RESULT, 'simulation'), 
                     (MINCUT_RESULT, 'mincut'), 
                     (ANALYSIS_RESULT, 'topevent'),
                     (PDF_RESULT, 'pdf'),
                     (EPS_RESULT, 'eps')]

    graph         = models.ForeignKey(Graph, related_name='results')
    job           = models.ForeignKey('Job', related_name='results')
    configuration = models.ForeignKey('Configuration', related_name='results', null=True, blank=True)
    kind          = models.CharField(max_length=1, choices= RESULT_TYPES)
    minimum       = models.FloatField(null=True)
    maximum       = models.FloatField(null=True)
    peak          = models.FloatField(null=True)
    reliability   = models.FloatField(null=True)
    mttf          = models.FloatField(null=True)
    rounds        = models.IntegerField(null=True)
    failures      = models.IntegerField(null=True)
    ratio         = models.FloatField(null=True)
    binary_value  = models.BinaryField(null=True)
    points        = JSONField(blank=True, null=True)
    issues        = JSONField(blank=True, null=True)

    def __unicode__(self):
        return "Result %u for graph %s and configuration %s:\n    %s\n    Issues: %s" % (
                  self.pk,
                  self.graph.pk, 
                  self.configuration.pk if self.configuration else "(None)", 
                  str(self.value) if self.value else "(None)",
                  str(self.issues) if self.issues else "(None)",                  
                )

    @property
    def is_binary(self):
        ''' Indicates if the result should be delivered directly to the frontend
            as file, or if it must be preprocessed with self.to_json().'''
        return self.kind in [Result.PDF_RESULT, Result.EPS_RESULT]

    def to_url(self):
        ''' Returns a binary result as view URL.'''
        assert(self.is_binary())
        if self.kind == Result.PDF_RESULT:
            kind = 'pdf'
        elif self.kind == Result.EPS_RESULT:
            kind = 'eps'
        return reverse('frontend_graph_download', args=[self.graph.pk]) + "?format="+kind

    @classmethod
    def titles(self, kind):
        ''' If the result is not binary, than it is JSON. This function returns
            the human-readable sorted names of data columns that can be shown directly,
            without further interpretation by the JS code. Therefore, some data returned
            by self.to_dict() is not included here.
        '''
        if kind == self.ANALYSIS_RESULT:
            return  (('id','Config'),('minimum','Min'),    ('peak','Peak'),
                     ('maximum','Max'),  ('costs','Costs'),('ratio','Risk'))            
        elif kind == self.SIMULATION_RESULT:
            return  (('id','Config'), ('reliability','Reliability'), ('mttf','MTTF'),
                      ('rounds', 'Rounds'), ('failures', 'Failures'))      
        elif kind == self.MINCUT_RESULT:
            return  (('id','Config'),)      

    def to_dict(self):
      '''
        Converts the result into a JSONable dictionary, which includes all information
        stored in this result object, plus data from the linked graph configuration.
      '''
      result = {}
      for field in ['minimum', 'maximum', 'peak', 'reliability', 'mttf', 'rounds', 'failures', 'ratio']:
        value = getattr(self, field)
        if value != None:
          result[field] = value
      if self.configuration:
          result['choices'] = self.configuration.to_dict() 
          result['id'] = self.configuration.pk
          result['costs'] = self.configuration.costs 
      if self.issues:
          result['issues'] = self.issues
      return result

