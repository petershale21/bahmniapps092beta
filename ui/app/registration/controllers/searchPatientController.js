'use strict';

angular.module('bahmni.registration')
    .controller('SearchPatientController', ['$rootScope', '$scope', '$location', '$window', 'spinner', 'patientService', 'appService',
        'messagingService', '$translate', '$filter', '$http',
        function ($rootScope, $scope, $location, $window, spinner, patientService, appService, messagingService, $translate, $filter, $http) {
            $scope.results = [];
            var naturalOrderBy = window.naturalOrderBy;
            $scope.direction = ['asc'];
            $scope.hieresults = [];

            $scope.option = {
                selected: "local"
            };

            $scope.searchDomains = {
                local: "Local",
                cag: "CAG",
                national: "National"
            };

            $scope.genderoption = {
                selected: "male"
            };

            $scope.genderoptions = {
                male: "M",
                female: "F"
            };

            $scope.showNationalId = function () {
                return $scope.option.selected == "national" ? true : false;
            };

            $scope.showLocalId = function () {
                return $scope.option.selected == "local" ? true : false;
            };

            $scope.showCAGName = function () {
                return $scope.option.selected == "cag" ? true : false;
            }

            $scope.extraIdentifierTypes = _.filter($rootScope.patientConfiguration.identifierTypes, function (identifierType) {
                return !identifierType.primary;
            });
            var searching = false;
            var maxAttributesFromConfig = 5;
            var allSearchConfigs = appService.getAppDescriptor().getConfigValue("patientSearch") || {};
            var patientSearchResultConfigs = appService.getAppDescriptor().getConfigValue("patientSearchResults") || {};
            maxAttributesFromConfig = !_.isEmpty(allSearchConfigs.programAttributes) ? maxAttributesFromConfig - 1 : maxAttributesFromConfig;

            $scope.getAddressColumnName = function (column) {
                var columnName = "";
                var columnCamelCase = column.replace(/([-_][a-z])/g, function ($1) {
                    return $1.toUpperCase().replace(/[-_]/, '');
                });
                _.each($scope.addressLevels, function (addressLevel) {
                    if (addressLevel.addressField === columnCamelCase) { columnName = addressLevel.name; }
                });
                return columnName;
            };

            var hasSearchParameters = function () {
                return $scope.searchParameters.name.trim().length > 0 ||
                    $scope.searchParameters.last_name.trim().length > 0 ||
                    $scope.searchParameters.addressFieldValue.trim().length > 0 ||
                    $scope.searchParameters.customAttribute.trim().length > 0 ||
                    $scope.searchParameters.programAttributeFieldValue.trim().length > 0 ||
                    $scope.searchParameters.nationalId.trim().length > 0 ||
                    $scope.searchParameters.cagName.trim().length > 0
            };

            $scope.sortPatient = function (param) {
                var paramArray = param.split('.');
                $scope.results = naturalOrderBy.orderBy($scope.results, [function (obj) {
                    var tempObj = obj;
                    paramArray.map(function (currentParam) {
                        if (tempObj[currentParam]) {
                            tempObj = tempObj[currentParam];
                        }
                    });
                    return tempObj;
                }], $scope.direction);
                if ($scope.direction[0] == 'asc') {
                    $scope.direction[0] = 'desc';
                } else {
                    $scope.direction[0] = 'asc';
                }
            };

            var searchBasedOnQueryParameters = function (offset) {
                if (!isUserPrivilegedForSearch()) {
                    showInsufficientPrivMessage();
                    return;
                }

                var searchParameters = $location.search();
                $scope.searchParameters.addressFieldValue = searchParameters.addressFieldValue || '';
                $scope.searchParameters.name = searchParameters.name || '';
                $scope.searchParameters.last_name = searchParameters.last_name || '';
                $scope.searchParameters.customAttribute = searchParameters.customAttribute || '';
                $scope.searchParameters.programAttributeFieldValue = searchParameters.programAttributeFieldValue || '';
                $scope.searchParameters.addressSearchResultsConfig = searchParameters.addressSearchResultsConfig || '';
                $scope.searchParameters.personSearchResultsConfig = searchParameters.personSearchResultsConfig || '';
                $scope.searchParameters.nationalId = searchParameters.nationalId || '';
                $scope.searchParameters.registrationNumber = searchParameters.registrationNumber || "";
                $scope.searchParameters.cagName = searchParameters.cagName || "";

                if (hasSearchParameters()) {
                    if ($scope.option.selected == "local") {
                        searching = true;
                        var searchPromise = patientService.search(
                            $scope.searchParameters.name + " " + $scope.searchParameters.last_name,
                            undefined,
                            $scope.addressSearchConfig.field,
                            $scope.searchParameters.addressFieldValue,
                            $scope.searchParameters.customAttribute,
                            offset,
                            $scope.customAttributesSearchConfig.fields,
                            $scope.programAttributesSearchConfig.field,
                            $scope.searchParameters.programAttributeFieldValue,
                            $scope.addressSearchResultsConfig.fields,
                            $scope.personSearchResultsConfig.fields,
                            $scope.searchParameters.nationalId
                        ).then(function (response) {
                            mapExtraIdentifiers(response);
                            mapCustomAttributesSearchResults(response);
                            mapAddressAttributesSearchResults(response);
                            mapProgramAttributesSearchResults(response);
                            return response;
                        });
                        searchPromise['finally'](function () {
                            searching = false;
                        });
                        return searchPromise;
                    }
                    else if ($scope.option.selected == "national") {
                        $scope.searchParameters.gender = searchParameters.gender == "male" ? "M" : "F";
                        searching = true;
                        var searchPromise = patientService.searchHIE(
                            $scope.searchParameters.name,
                            $scope.searchParameters.last_name,
                            undefined,
                            $scope.searchParameters.nationalId,
                            $scope.searchParameters.gender,
                            $scope.addressSearchConfig.field,
                            $scope.searchParameters.addressFieldValue,
                            $scope.searchParameters.customAttribute,
                            offset,
                            $scope.customAttributesSearchConfig.fields,
                            $scope.programAttributesSearchConfig.field,
                            $scope.searchParameters.programAttributeFieldValue,
                            $scope.addressSearchResultsConfig.fields,
                            $scope.personSearchResultsConfig.fields
                        ).then(function (response) {

                            mapExtraIdentifiers(response);

                            if (response.pageOfResults.length > 0) {

                                $scope.hieresults = response.pageOfResults;
                                $scope.noResultsMessage = null;

                            } else {
                                $scope.noResultsMessage = 'REGISTRATION_LABEL_COULD_NOT_FIND_PATIENT';
                            }
                        });


                        spinner.forPromise(searchPromise);

                    }
                }
            };
            $scope.convertToTableHeader = function (camelCasedText) {
                return camelCasedText.replace(/[A-Z]|^[a-z]/g, function (str) {
                    return " " + str.toUpperCase() + "";
                }).trim();
            };

            $scope.getProgramAttributeValues = function (result) {
                var attributeValues = result && result.patientProgramAttributeValue && result.patientProgramAttributeValue[$scope.programAttributesSearchConfig.field];
                var commaSeparatedAttributeValues = "";
                _.each(attributeValues, function (attr) {
                    commaSeparatedAttributeValues = commaSeparatedAttributeValues + attr + ", ";
                });
                return commaSeparatedAttributeValues.substring(0, commaSeparatedAttributeValues.length - 2);
            };

            var mapExtraIdentifiers = function (data) {
                if (data !== "Searching") {
                    _.each(data.pageOfResults, function (result) {
                        result.extraIdentifiers = result.extraIdentifiers && JSON.parse(result.extraIdentifiers);
                    });
                }
            };

            var mapCustomAttributesSearchResults = function (data) {
                if (($scope.personSearchResultsConfig.fields) && data !== "Searching") {
                    _.map(data.pageOfResults, function (result) {
                        result.customAttribute = result.customAttribute && JSON.parse(result.customAttribute);
                    });
                }
            };

            var mapAddressAttributesSearchResults = function (data) {
                if (($scope.addressSearchResultsConfig.fields) && data !== "Searching") {
                    _.map(data.pageOfResults, function (result) {
                        try {
                            result.addressFieldValue = JSON.parse(result.addressFieldValue);
                        } catch (e) {
                        }
                    });
                }
            };

            var mapProgramAttributesSearchResults = function (data) {
                if (($scope.programAttributesSearchConfig.field) && data !== "Searching") {
                    _.map(data.pageOfResults, function (result) {
                        var programAttributesObj = {};
                        var arrayOfStringOfKeysValue = result.patientProgramAttributeValue && result.patientProgramAttributeValue.substring(2, result.patientProgramAttributeValue.length - 2).split('","');
                        _.each(arrayOfStringOfKeysValue, function (keyValueString) {
                            var keyValueArray = keyValueString.split('":"');
                            var key = keyValueArray[0];
                            var value = keyValueArray[1];
                            if (!_.includes(_.keys(programAttributesObj), key)) {
                                programAttributesObj[key] = [];
                                programAttributesObj[key].push(value);
                            } else {
                                programAttributesObj[key].push(value);
                            }
                        });
                        result.patientProgramAttributeValue = programAttributesObj;
                    });
                }
            };

            var showSearchResults = function (searchPromise) {
                $scope.noMoreResultsPresent = false;
                if (searchPromise) {
                    searchPromise.then(function (data) {
                        if ($scope.option.selected == "local") {
                            $scope.results = data.pageOfResults;
                            $scope.noResultsMessage = $scope.results.length === 0 ? 'REGISTRATION_NO_RESULTS_FOUND' : null;
                        } else if ($scope.option.selected == "national") {
                            $scope.hieresults = data.pageOfResults;
                            $scope.noResultsMessage = $scope.hieresults.length === 0 ? 'REGISTRATION_NO_RESULTS_FOUND' : null;
                        }
                    });
                }
            };

            var setPatientIdentifierSearchConfig = function () {
                $scope.patientIdentifierSearchConfig = {};
                $scope.patientIdentifierSearchConfig.show = allSearchConfigs.searchByPatientIdentifier === undefined ? true : allSearchConfigs.searchByPatientIdentifier;
            };

            var setCAGNameSearchConfig = function () {
                $scope.CAGNameSearchConfig = {};
                $scope.CAGNameSearchConfig.show == allSearchConfigs.searchByCAGName === undefined ? true : allSearchConfigs.searchByCAGName;
            }

            var setAddressSearchConfig = function () {
                $scope.addressSearchConfig = allSearchConfigs.address || {};
                $scope.addressSearchConfig.show = !_.isEmpty($scope.addressSearchConfig) && !_.isEmpty($scope.addressSearchConfig.field);
                if ($scope.addressSearchConfig.label && !$scope.addressSearchConfig.label) {
                    throw new Error("Search Config label is not present!");
                }
                if ($scope.addressSearchConfig.field && !$scope.addressSearchConfig.field) {
                    throw new Error("Search Config field is not present!");
                }
            };

            var setCustomAttributesSearchConfig = function () {
                var customAttributesSearchConfig = allSearchConfigs.customAttributes;
                $scope.customAttributesSearchConfig = customAttributesSearchConfig || {};
                $scope.customAttributesSearchConfig.show = !_.isEmpty(customAttributesSearchConfig) && !_.isEmpty(customAttributesSearchConfig.fields);
            };

            var setProgramAttributesSearchConfig = function () {
                $scope.programAttributesSearchConfig = allSearchConfigs.programAttributes || {};
                $scope.programAttributesSearchConfig.show = !_.isEmpty($scope.programAttributesSearchConfig.field);
            };

            var sliceExtraColumns = function () {
                var orderedColumns = Object.keys(patientSearchResultConfigs);
                _.each(orderedColumns, function (column) {
                    if (patientSearchResultConfigs[column].fields && !_.isEmpty(patientSearchResultConfigs[column].fields)) {
                        patientSearchResultConfigs[column].fields = patientSearchResultConfigs[column].fields.slice(patientSearchResultConfigs[column].fields, maxAttributesFromConfig);
                        maxAttributesFromConfig -= patientSearchResultConfigs[column].fields.length;
                    }
                });
            };

            var setSearchResultsConfig = function () {
                var resultsConfigNotFound = false;
                if (_.isEmpty(patientSearchResultConfigs)) {
                    resultsConfigNotFound = true;
                    patientSearchResultConfigs.address = { "fields": allSearchConfigs.address ? [allSearchConfigs.address.field] : {} };
                    patientSearchResultConfigs.personAttributes
                        = { fields: allSearchConfigs.customAttributes ? allSearchConfigs.customAttributes.fields : {} };
                } else {
                    if (!patientSearchResultConfigs.address) patientSearchResultConfigs.address = {};
                    if (!patientSearchResultConfigs.personAttributes) patientSearchResultConfigs.personAttributes = {};
                }

                if (patientSearchResultConfigs.address.fields && !_.isEmpty(patientSearchResultConfigs.address.fields)) {
                    patientSearchResultConfigs.address.fields =
                        patientSearchResultConfigs.address.fields.filter(function (item) {
                            return !_.isEmpty($scope.getAddressColumnName(item));
                        });
                }
                if (!resultsConfigNotFound) sliceExtraColumns();
                $scope.personSearchResultsConfig = patientSearchResultConfigs.personAttributes;
                $scope.addressSearchResultsConfig = patientSearchResultConfigs.address;
            };

            var initialize = function () {
                $scope.searchParameters = {};
                $scope.searchActions = appService.getAppDescriptor().getExtensions("org.bahmni.registration.patient.search.result.action");
                setPatientIdentifierSearchConfig();
                setCAGNameSearchConfig();
                setAddressSearchConfig();
                setCustomAttributesSearchConfig();
                setProgramAttributesSearchConfig();
                setSearchResultsConfig();
            };

            var identifyParams = function (querystring) {
                querystring = querystring.substring(querystring.indexOf('?') + 1).split('&');
                var params = {}, pair, d = decodeURIComponent;
                for (var i = querystring.length - 1; i >= 0; i--) {
                    pair = querystring[i].split('=');
                    params[d(pair[0])] = d(pair[1]);
                }
                return params;
            };

            initialize();

            $scope.disableSearchButton = function () {
                var disabled = true;

                if ($scope.option.selected == "national") {
                    disabled = !$scope.searchParameters.name && !$scope.searchParameters.addressFieldValue
                        && !$scope.searchParameters.last_name
                        && !$scope.searchParameters.addressFieldValue
                        && !$scope.searchParameters.customAttribute
                        && !$scope.searchParameters.programAttributeFieldValue
                        && !$scope.searchParameters.nationalIdNumber;
                } else if ($scope.option.selected == "local") {
                    disabled = !$scope.searchParameters.name && !$scope.searchParameters.addressFieldValue
                        && !$scope.searchParameters.last_name
                        && !$scope.searchParameters.customAttribute
                        && !$scope.searchParameters.programAttributeFieldValue;
                }
                return disabled;
            };

            $scope.$watch(function () {
                return $location.search();
            }, function () {
                showSearchResults(searchBasedOnQueryParameters(0));
            });

            $scope.searchById = function () {
                if (!isUserPrivilegedForSearch()) {
                    showInsufficientPrivMessage();
                    return;
                }
                if (!$scope.searchParameters.registrationNumber) {
                    return;
                }
                $scope.results = [];
                $scope.hieresults = [];

                var patientIdentifier = $scope.searchParameters.registrationNumber;
                $location.search({
                    registrationNumber: $scope.searchParameters.registrationNumber,
                    programAttributeFieldName: $scope.programAttributesSearchConfig.field,
                    patientAttributes: $scope.customAttributesSearchConfig.fields,
                    programAttributeFieldValue: $scope.searchParameters.programAttributeFieldValue,
                    addressSearchResultsConfig: $scope.addressSearchResultsConfig.fields,
                    personSearchResultsConfig: $scope.personSearchResultsConfig.fields
                });
                if ($scope.option.selected == "local") {
                    var searchPromise = patientService.search(undefined, patientIdentifier, $scope.addressSearchConfig.field,
                        undefined, undefined, undefined, $scope.customAttributesSearchConfig.fields,
                        $scope.programAttributesSearchConfig.field, $scope.searchParameters.programAttributeFieldValue,
                        $scope.addressSearchResultsConfig.fields, $scope.personSearchResultsConfig.fields,
                        $scope.isExtraIdentifierConfigured())
                        .then(function (data) {
                            mapExtraIdentifiers(data);
                            mapCustomAttributesSearchResults(data);
                            mapAddressAttributesSearchResults(data);
                            mapProgramAttributesSearchResults(data);
                            if (data.pageOfResults.length === 1) {
                                var patient = data.pageOfResults[0];
                                var forwardUrl = appService.getAppDescriptor().getConfigValue("searchByIdForwardUrl") || "/patient/{{patientUuid}}";
                                $location.url(appService.getAppDescriptor().formatUrl(forwardUrl, { 'patientUuid': patient.uuid }));
                            } else if (data.pageOfResults.length > 1) {
                                $scope.results = data.pageOfResults;
                                $scope.noResultsMessage = null;
                            } else {
                                $scope.patientIdentifier = { 'patientIdentifier': patientIdentifier };
                                $scope.noResultsMessage = 'REGISTRATION_LABEL_COULD_NOT_FIND_PATIENT';
                            }
                        });
                    spinner.forPromise(searchPromise);
                } else if ($scope.option.selected == "national") {
                    var searchPromise = patientService.searchHIE(undefined, patientIdentifier, undefined, undefined, $scope.addressSearchConfig.field,
                        undefined, undefined, undefined, $scope.customAttributesSearchConfig.fields,
                        $scope.programAttributesSearchConfig.field, $scope.searchParameters.programAttributeFieldValue,
                        $scope.addressSearchResultsConfig.fields, $scope.personSearchResultsConfig.fields,
                        $scope.isExtraIdentifierConfigured())
                        .then(function (data) {
                            mapExtraIdentifiers(data);
                            mapCustomAttributesSearchResults(data);
                            mapAddressAttributesSearchResults(data);
                            mapProgramAttributesSearchResults(data);

                            if (data.pageOfResults.length > 0) {
                                $scope.hieresults = data.pageOfResults;
                                $scope.noResultsMessage = null;
                            } else {
                                $scope.patientIdentifier = { 'patientIdentifier': patientIdentifier };
                                $scope.noResultsMessage = 'REGISTRATION_LABEL_COULD_NOT_FIND_PATIENT';
                            }
                        });
                    spinner.forPromise(searchPromise);
                }
            };

            $scope.importPatientFromCR = function (patient) {
                var importPromise = patientService.importPatient(patient).then(function (response) {
                    if (response.length > 0) {
                        var forwardUrl = appService.getAppDescriptor().getConfigValue("searchByIdForwardUrl") || "/patient/{{patientUuid}}";
                        $location.url(appService.getAppDescriptor().formatUrl(forwardUrl, { 'patientUuid': response[0].uuid }));
                    }
                });
                spinner.forPromise(importPromise);
            };

            var isUserPrivilegedForSearch = function () {
                var applicablePrivs = [Bahmni.Common.Constants.viewPatientsPrivilege, Bahmni.Common.Constants.editPatientsPrivilege,
                Bahmni.Common.Constants.addVisitsPrivilege, Bahmni.Common.Constants.deleteVisitsPrivilege];
                var userPrivs = _.map($rootScope.currentUser.privileges, function (privilege) {
                    return privilege.name;
                });
                var result = _.some(userPrivs, function (privName) {
                    return _.includes(applicablePrivs, privName);
                });
                return result;
            };

            var showInsufficientPrivMessage = function () {
                var message = $translate.instant("REGISTRATION_INSUFFICIENT_PRIVILEGE");
                messagingService.showMessage('error', message);
            };

            $scope.loadingMoreResults = function () {
                return searching && !$scope.noMoreResultsPresent;
            };

            $scope.searchPatients = function () {
                if (!isUserPrivilegedForSearch()) {
                    showInsufficientPrivMessage();
                    return;
                }

                var queryParams = {};
                $scope.results = [];
                $scope.hieresults = [];
                if ($scope.searchParameters.name) {
                    queryParams.name = $scope.searchParameters.name;
                }
                if ($scope.searchParameters.last_name) {
                    queryParams.last_name = $scope.searchParameters.last_name;
                }
                if ($scope.searchParameters.addressFieldValue) {
                    queryParams.addressFieldValue = $scope.searchParameters.addressFieldValue;
                }
                if ($scope.searchParameters.customAttribute && $scope.customAttributesSearchConfig.show) {
                    queryParams.customAttribute = $scope.searchParameters.customAttribute;
                }
                if ($scope.searchParameters.programAttributeFieldValue && $scope.programAttributesSearchConfig.show) {
                    queryParams.programAttributeFieldName = $scope.programAttributesSearchConfig.field;
                    queryParams.programAttributeFieldValue = $scope.searchParameters.programAttributeFieldValue;
                }

                if ($scope.searchParameters.nationalIdNumber) {
                    queryParams.nationalId = $scope.searchParameters.nationalIdNumber;
                }

                queryParams.gender = $scope.genderoption.selected;
                $location.search(queryParams);
            };

            $scope.resultsPresent = function () {
                return angular.isDefined($scope.results) && $scope.results.length > 0;
            };

            $scope.hieresultsPresent = function () {
                return angular.isDefined($scope.hieresults) && $scope.hieresults.length > 0;
            };

            // $scope.cagResultsPresent = function () {
            //     $scope.searchByCAGName();
            // }

            $scope.editPatientUrl = function (url, options) {
                var temp = url;
                for (var key in options) {
                    temp = temp.replace("{{" + key + "}}", options[key]);
                }
                return temp;
            };

            $scope.nextPage = function () {
                if ($scope.nextPageLoading) {
                    return;
                }
                $scope.nextPageLoading = true;
                var promise = searchBasedOnQueryParameters($scope.results.length);
                if (promise) {
                    promise.then(function (data) {
                        angular.forEach(data.pageOfResults, function (result) {
                            $scope.results.push(result);
                        });
                        $scope.noMoreResultsPresent = (data.pageOfResults.length === 0);
                        $scope.nextPageLoading = false;
                    }, function () {
                        $scope.nextPageLoading = false;
                    });
                }
            };
            $scope.cagResults=[];
            $scope.searchByCAGName = function (){
                var apiUrl = 'https://192.168.33.10/openmrs/ws/rest/v1/cag?v=full';

            // Define a function to make the API request and log the response
            // function makeApiRequest() {
                $http.get(apiUrl)
                .then(function(response) {
                    // Handle the successful response here
                    console.log('API Response:', response.data);
                    $scope.cagResults = response.data.results;
                })
                .catch(function(error) {
                    // Handle any errors that occurred during the request
                    console.error('API Error:', error);
                });
            // }
            }
            $scope.viewCAG = function(cagUuid){
                // $scope.CAGdoExtensionAction(apiUrl,uuid);
                $location.url('/cag/'+cagUuid);
            }

            

            $scope.forPatient = function (patient) {
                $scope.selectedPatient = patient;
                return $scope;
            };

            $scope.doExtensionAction = function (extension) {
                var forwardTo = appService.getAppDescriptor().formatUrl(extension.url, { 'patientUuid': $scope.selectedPatient.uuid });
                if (extension.label === 'Print') {
                    var params = identifyParams(forwardTo);
                    if (params.launch === 'dialog') {
                        var firstChar = forwardTo.charAt(0);
                        var prefix = firstChar === "/" ? "#" : "#/";
                        var hiddenFrame = $("#printPatientFrame")[0];
                        hiddenFrame.src = prefix + forwardTo;
                        hiddenFrame.contentWindow.print();
                    } else {
                        $location.url(forwardTo);
                    }
                } else {
                    $location.url(forwardTo);
                }
            };

            $scope.extensionActionText = function (extension) {
                return $filter('titleTranslate')(extension);
            };

            $scope.isExtraIdentifierConfigured = function () {
                return !_.isEmpty($scope.extraIdentifierTypes);
            };
        }]);
