'use strict';

angular.module('bahmni.registration')
    .service('cagService', ['$http', '$rootScope', '$bahmniCookieStore', '$q', 'patientServiceStrategy', 'sessionService', function ($http, $rootScope, $bahmniCookieStore, $q, patientServiceStrategy, sessionService) {
        var openmrsUrl = Bahmni.Registration.Constants.openmrsUrl;
        var baseOpenMRSRESTURL = Bahmni.Registration.Constants.baseOpenMRSRESTURL;
        

        this.run = function () {
            return "cag Service running";
        }

    }]);