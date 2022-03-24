'use strict';

angular.module('bahmni.clinical')
    .controller('SharedRecordPageController', ['$scope', '$rootScope', '$state', '$location', 'sharedHealthRecordService', 'spinner', 'patientContext', 'messagingService', function ($scope,
        $rootScope, $state, $location, sharedHealthRecordService, spinner, patientContext, messagingService) {
        $scope.results = [];
        $scope.restResults = [];
        $scope.today = Bahmni.Common.Util.DateUtil.getDateWithoutTime(Bahmni.Common.Util.DateUtil.now());

        $scope.findClinicalDocumentsForPatient = function () {
            var queryParams = {};

            queryParams.patientUuid = patientContext.patient.uuid;
            queryParams.patientIdentifier = patientContext.patient.identifier;

            if ($scope.fromDate && $scope.toDate) {
                queryParams.fromDate = toShortDate($scope.fromDate);
                queryParams.toDate = toShortDate($scope.toDate);
            }

            $location.search(queryParams);
        };

        var toShortDate = function (date) {
            return Bahmni.Common.Util.DateUtil.getDateWithoutTime(date);
        };

        $scope.$watch(function () {
            return $location.search();
        }, function () {
            showSearchResults(searchBasedOnQueryParameters(0));
        });

        var showSearchResults = function (searchPromise) {
            $scope.noMoreResultsPresent = false;
            if (searchPromise) {
                searchPromise.then(function (data) {
                    $scope.results = data.pageOfResults;
                    $scope.noResultsMessage = $scope.results.length === 0 ? 'No patient records found for patient in HIE' : null;
                });
            }
        };

        var searchBasedOnQueryParameters = function (offset) {
            var searchParameters = $location.search();
            $scope.searchParameters.patientUuid = searchParameters.patientUuid || '';
            $scope.searchParameters.patientIdentifier = searchParameters.patientIdentifier || '';
            $scope.searchParameters.fromDate = searchParameters.fromDate || '';
            $scope.searchParameters.toDate = searchParameters.toDate || '';

            if (hasSearchParameters()) {
                var searchPromise = sharedHealthRecordService.search(
                    $scope.searchParameters.patientUuid,
                    $scope.searchParameters.patientIdentifier,
                    $scope.searchParameters.fromDate,
                    $scope.searchParameters.toDate,
                    offset
                ).then(function (response) {
                    _.each(response.pageOfResults, function (result) {
                        result.encounterDate = convertToStandardISODateTime(result.encounterDate);
                        result.location = convertToStandardLocation(result.location);
                        result.providerID = convertToStandardProviderNames(result.providerID);
                    });

                    if (response.pageOfResults.length > 0) {
                        $scope.results = response.pageOfResults;
                        $scope.noResultsMessage = null;
                    }
                });
                spinner.forPromise(searchPromise);
            }
        };

        var initialize = function () {
            $scope.searchParameters = {};
        };

        var hasSearchParameters = function () {
            return $scope.searchParameters.patientUuid.trim().length > 0 &&
                $scope.searchParameters.patientIdentifier.trim().length > 0 &&
                $scope.searchParameters.fromDate.trim().length > 0 &&
                $scope.searchParameters.toDate.trim().length > 0;
        };

        $scope.retriveAndImportDocument = function (document) {
            var importPromise = sharedHealthRecordService.retriveAndImportDocument(document.documentID).then(function (response) {
                if (response.successful) {
                    messagingService.showMessage('info', response.message);
                } else if (!response.successful) {
                    messagingService.showMessage('error', response.message);
                }
            });
            spinner.forPromise(importPromise);
        };

        $scope.retriveAndViewObs = function () {
            var importPromise = sharedHealthRecordService.retriveAndViewObs(patientContext.patient.identifier).then(function (response) {
                $scope.restResults = response;
                $scope.noResultsMessage = $scope.restResults.length === 0 ? 'No patient records found for patient in HIE' : null;
            });
            spinner.forPromise(importPromise);
        };       

        $scope.resultsPresent = function () {
            return angular.isDefined($scope.results) && $scope.results.length > 0;
        };

        $scope.restResultsPresent = function () {
            return angular.isDefined($scope.restResults) && $scope.restResults.length > 0;
        };

        var convertToStandardISODateTime = function (encounterDate) {
            var year = encounterDate.substring(0, 4), month = encounterDate.substring(4, 6), day = encounterDate.substring(6, 8),
                hour = encounterDate.substring(8, 10), minutes = encounterDate.substring(10, 12);
            return moment(year + "-" + month + "-" + day + " " + hour + ":" + minutes).format('D-MMM-YYYY HH:mm');
        };

        var convertToStandardLocation = function (location) {
            return _.split(location, '^', 2)[0];
        };

        var convertToStandardProviderNames = function (provider) {
            var providerStrArr = _.split(provider, '^');
            return providerStrArr[2] + " " + providerStrArr[1];
        };

        $scope.disableSearchButton = function () {
            return !($scope.fromDate && $scope.toDate);
        };

        initialize();
    }]);
