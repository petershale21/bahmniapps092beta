'use strict';

angular.module('bahmni.common.domain')
    .service('cagService', ['$http', '$rootScope', '$bahmniCookieStore', '$q', 'patientServiceStrategy', 'sessionService', function ($http, $rootScope, $bahmniCookieStore, $q, patientServiceStrategy, sessionService) {
        var openmrsUrl = Bahmni.Registration.Constants.openmrsUrl;
        var baseOpenMRSRESTURL = Bahmni.Registration.Constants.baseOpenMRSRESTURL;
        

        this.run = function () {
            return "cag Service running";
        }

        this.getCag = function (uuid) {
            var cag = $http.get(Bahmni.Common.Constants.openmrsUrl + "/ws/rest/v1/cag/" + uuid, {
                method: "GET",
                params: {v: "full"},
                withCredentials: true
            });
            return cag;
        };

        this.getAllCags = function () {
            var cags = $http.get(Bahmni.Common.Constants.openmrsUrl + "/ws/rest/v1/cag/" , {
                method: "GET",
                params: {v: "full"},
                withCredentials: true
            });
            return cags;
        };

    }]);