import base64
import logging
import json

from django.core.exceptions import ObjectDoesNotExist, MultipleObjectsReturned
from django.core.mail import mail_managers
from django.http import HttpResponse
from tastypie.http import HttpBadRequest
from tastypie import fields
from django.conf.urls import url
from django.utils import http


import common
from FuzzEd.models import Job
from FuzzEd import settings

logger = logging.getLogger('FuzzEd')

class JobResource(common.JobResource):
    """
        An API resource for jobs.
        It behaves differently than the job resource API for frontend and external clients,
        since it only focuses on feeding the backend daemon(s).
    """
    class Meta:
        queryset = Job.objects.all()
        detail_allowed_methods = ['get', 'patch']
        detail_uri_name = 'secret'

    graph = fields.ToOneField('FuzzEd.api.common.GraphResource', 'graph')

    def prepend_urls(self):
        """
            Make sure that job access is only possible with the job secret.
            This gives us the liberty to avoid any shared secret between backend and frontend,
            since it is part of each single job URL.
            Ultimatively, this means that backend daemon(s) do not need to authenticate at all.
        """
        return [
            url(r"^jobs/(?P<secret>[\w\d_.-]+)$",
                self.wrap_view('dispatch_detail'),
                name="job"),
        ]

    def get_detail(self, request, **kwargs):
        """
            Allows the backend to retrieve the job input file.
        """
        basic_bundle = self.build_bundle(request=request)
        try:
            job = self.cached_obj_get(bundle=basic_bundle, **self.remove_api_resource_names(kwargs))
        except ObjectDoesNotExist:
            return http.HttpNotFound()
        except MultipleObjectsReturned:
            return http.HttpMultipleChoices("More than one resource is found at this URI.")

        logger.debug("Delivering data for job %d"%job.pk)
        response = HttpResponse()
        response.content, response['Content-Type'] = job.input_data()
        logger.debug(response.content)
        return response


    def patch_detail(self, request, **kwargs):
        """
            Allows the backend to upload the result file(s).
            We could also override obj_update, which is
            the Tastypie intended-way of having a custom PATCH implementation, but this
            method gets a full updated object bundle that is expected to be directly written
            to the object. In this method, we still have access to what actually really
            comes as part of the update payload.

            The result comes as 'application/json' dictionary content,
            with an entry for the exit code of the backend service and the base64-encoded file data.

            If the resource is updated, return ``HttpAccepted`` (202 Accepted).
            If the resource did not exist, return ``HttpNotFound`` (404 Not Found).
        """
        try:
            # Fetch relevant job object as Tastypie does it
            basic_bundle = self.build_bundle(request=request)
            job = self.cached_obj_get(bundle=basic_bundle, **self.remove_api_resource_names(kwargs))
        except ObjectDoesNotExist:
            return http.HttpNotFound()
        except MultipleObjectsReturned:
            return http.HttpMultipleChoices("More than one resource is found at this URI.")

        if job.done():
            logger.error("Job already done, discarding uploaded results")
            return HttpResponse(status=202)     # This return code is a lie, but mitigates duplicate result submission
        else:
            logger.debug("Parsing and storing result data for job %d"%job.pk)
            try:
                result = json.loads(request.body)
                assert('exit_code' in result)
            except:
                return HttpBadRequest()
            job.exit_code = result['exit_code']   
            if "file_name" in result:
                try:
                    job.parse_result(base64.b64decode(result['file_data']))
                except Exception as e:
                    if settings.DEBUG:
                        logger.error(e)
                        raise e
                    else: 
                        # Do not blame the calling backend for parsing problems, it has done it's job
                        logger.error("Could not parse result data retrieved for job %u"%job.pk)
                        mail_managers("Exception on backend result parsing - " + settings.BACKEND_DAEMON, str(e))
                        job.exit_code = -444  # Inform the frontend that this went wrong   
        # This immediately triggers pulling clients to get the result data, so it MUST be the very last thing to do
	    job.save() 
        return HttpResponse(status=202)
