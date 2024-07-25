'use strict';

angular.module('bahmni.common.patientSearch')
.controller('PatientsListController', ['$scope', '$window', 'patientService', '$rootScope', 'appService', 'spinner',
    '$stateParams', '$bahmniCookieStore', 'printer', 'configurationService', '$q',
    function ($scope, $window, patientService, $rootScope, appService, spinner, $stateParams, $bahmniCookieStore, printer, configurationService, $q) {
        const DEFAULT_FETCH_DELAY = 2000;
        var patientSearchConfig = appService.getAppDescriptor().getConfigValue("patientSearch");
        var patientListSpinner;
        $scope.otherCagMember=[];
        $scope.cagname={};
        var initialize = function () {
            // $scope.cagLoad=1;
            var searchTypes = appService.getAppDescriptor().getExtensions("org.bahmni.patient.search", "config").map(mapExtensionToSearchType);
            $scope.search = new Bahmni.Common.PatientSearch.Search(_.without(searchTypes, undefined));
            $scope.search.markPatientEntry();
            $scope.$watch('search.searchType', function (currentSearchType) {
                _.isEmpty(currentSearchType) || fetchPatients(currentSearchType);
            });
            if (patientSearchConfig && patientSearchConfig.serializeSearch) {
                getPatientCountSeriallyBySearchIndex(0);
            }
            else {
                _.each($scope.search.searchTypes, function (searchType) {
                    _.isEmpty(searchType) || ($scope.search.searchType != searchType && getPatientCount(searchType, null));
                });
            }
            if ($rootScope.currentSearchType != null) {
                $scope.search.switchSearchType($rootScope.currentSearchType);
            }
            configurationService.getConfigurations(['identifierTypesConfig']).then(function (response) {
                $scope.primaryIdentifier = _.find(response.identifierTypesConfig, {primary: true}).name;
            });
        };
        
        $scope.searchotherCagMembers = function(key){
            for(var i=0;i<$scope.otherCagMember.length;i++){
                if(key==$scope.otherCagMember.member_uuid){
                    return 1;
                }
            }
            return 0;
        }
        $scope.isCagVisit = function(patientx,index) {
            if(patientx.activeVisitUuid!=null){
                appService.fetchingVisitDatabyUuid(patientx.activeVisitUuid).then(function(res) {
                    if(res.data.display){
                        if(res.data.display.substring(0,3)=="CAG"){
                            patientx['showIsCag'] = true;
                            patientx['presentMember'] = false;
                            // patientx['cagName'] = "";
                            appService.getCagVisit(patientx.uuid).then(function(response){
                                if(response.data.results && response.data.results.length>0){
                                    if(response.data.results[0].attender.uuid==patientx.uuid){
                                        patientx['presentMember'] = true;
                                        patientx['cagName'] = response.data.results[0].cag.name;
                                    }
                                    for (let i = 0; i < response.data.results[0].visits.length; i++) {
                                        if(patientx.uuid!=response.data.results[0].visits[i].patient.uuid){
                                            if(!$scope.cagname.hasOwnProperty(patientx.uuid)){
                                                $scope.cagname[response.data.results[0].visits[i].patient.uuid]=response.data.results[0].cag.name;
                                            }
                                        }                                    
                                    }
                                }
                                else if(response.data.results && response.data.results.length==0){
                                    var member={
                                        "member_uuid":patientx.uuid,
                                        "index":index
                                    }
                                    if($scope.searchotherCagMembers(patientx.uuid)==0){
                                        $scope.otherCagMember.push(member);
                                    }
                                }
                                for(var i=0;i<$scope.otherCagMember.length;i++){
                                    if($scope.otherCagMember[i].member_uuid!=undefined && $scope.otherCagMember[i].index!=undefined && $scope.search.visiblePatients[$scope.otherCagMember[i].index]!=undefined){
                                        if($scope.cagname.hasOwnProperty($scope.otherCagMember[i].member_uuid)){
                                            var x=$scope.otherCagMember[i].member_uuid
                                            $scope.search.visiblePatients[$scope.otherCagMember[i].index]['cagName']=$scope.cagname[x];
                                        }
                                    }
                                }
                            });
                        }
                    }
                }) 
            }
        }
        
        $scope.searchPatients = function () {
            return spinner.forPromise(patientService.search($scope.search.searchParameter)).then(function (response) {
                $scope.search.updateSearchResults(response.data.pageOfResults);
                // if ($scope.search.hasSingleActivePatient() ) {
                if (response.data.pageOfResults.length==1) {
                    if( response.data.pageOfResults[0].presentMember==true){
                        $scope.forwardPatient($scope.search.activePatients[0]);
                    }
                }
            });
        };

        $scope.filterPatientsAndSubmit = function () {
            if ($scope.search.searchResults.length == 1) {
                $scope.forwardPatient($scope.search.searchResults[0]);
            }
        };
        var getPatientCount = function (searchType, patientListSpinner) {
            if (searchType.handler) {
                var params = { q: searchType.handler, v: "full",
                    location_uuid: $bahmniCookieStore.get(Bahmni.Common.Constants.locationCookieName).uuid,
                    provider_uuid: $rootScope.currentProvider.uuid };
                if (searchType.additionalParams) {
                    params["additionalParams"] = searchType.additionalParams;
                }
                patientService.findPatients(params).then(function (response) {
                    searchType.patientCount = response.data.length;
                    if ($scope.search.isSelectedSearch(searchType)) {
                        $scope.search.updatePatientList(response.data);
                    }
                    if (patientListSpinner) {
                        hideSpinner(spinner, patientListSpinner, $(".tab-content"));
                    }
                });
            }
        };

        var hideSpinner = function (spinnerObj, data, container) {
            spinnerObj.hide(data, container);
            $(container).children('patient-list-spinner').hide();
        };

        $scope.getHeadings = function (patients) {
            if (patients && patients.length > 0) {
                var headings = _.chain(patients[0])
                    .keys()
                    .filter(function (heading) {
                        return _.indexOf(Bahmni.Common.PatientSearch.Constants.tabularViewIgnoreHeadingsList, heading) === -1;
                    })
                    .value();

                return headings;
            }
            return [];
        };
        $scope.isHeadingOfLinkColumn = function (heading) {
            var identifierHeading = _.includes(Bahmni.Common.PatientSearch.Constants.identifierHeading, heading);
            if (identifierHeading) {
                return identifierHeading;
            } else if ($scope.search.searchType && $scope.search.searchType.links) {
                return _.find($scope.search.searchType.links, {linkColumn: heading});
            }
            else if ($scope.search.searchType && $scope.search.searchType.linkColumn) {
                return _.includes([$scope.search.searchType.linkColumn], heading);
            }
        };
        $scope.isHeadingOfName = function (heading) {
            return _.includes(Bahmni.Common.PatientSearch.Constants.nameHeading, heading);
        };
        $scope.getPrintableHeadings = function (patients) {
            var headings = $scope.getHeadings(patients);
            var printableHeadings = headings.filter(function (heading) {
                return _.indexOf(Bahmni.Common.PatientSearch.Constants.printIgnoreHeadingsList, heading) === -1;
            });
            return printableHeadings;
        };
        $scope.printPage = function () {
            if ($scope.search.searchType.printHtmlLocation != null) {
                printer.printFromScope($scope.search.searchType.printHtmlLocation, $scope);
            }
        };

        var mapExtensionToSearchType = function (appExtn) {
            return {
                name: appExtn.label,
                display: appExtn.extensionParams.display,
                handler: appExtn.extensionParams.searchHandler,
                forwardUrl: appExtn.extensionParams.forwardUrl,
                id: appExtn.id,
                params: appExtn.extensionParams.searchParams,
                refreshTime: appExtn.extensionParams.refreshTime || 0,
                view: appExtn.extensionParams.view || Bahmni.Common.PatientSearch.Constants.searchExtensionTileViewType,
                showPrint: appExtn.extensionParams.showPrint || false,
                printHtmlLocation: appExtn.extensionParams.printHtmlLocation || null,
                additionalParams: appExtn.extensionParams.additionalParams,
                searchColumns: appExtn.extensionParams.searchColumns,
                translationKey: appExtn.extensionParams.translationKey,
                linkColumn: appExtn.extensionParams.linkColumn,
                links: appExtn.extensionParams.links
            };
        };

        var debounceGetPatientCount = _.debounce(function (currentSearchType, patientListSpinner) {
            getPatientCount(currentSearchType, patientListSpinner);
        }, (patientSearchConfig && patientSearchConfig.fetchDelay) || DEFAULT_FETCH_DELAY, {});

        var showSpinner = function (spinnerObj, container) {
            $(container).children('patient-list-spinner').show();
            return spinnerObj.show(container);
        };

        var fetchPatients = function (currentSearchType) {
            if (patientListSpinner !== undefined) {
                hideSpinner(spinner, patientListSpinner, $(".tab-content"));
            }
            $rootScope.currentSearchType = currentSearchType;
            if ($scope.search.isCurrentSearchLookUp()) {
                patientListSpinner = showSpinner(spinner, $(".tab-content"));
                if (patientSearchConfig && patientSearchConfig.debounceSearch) {
                    debounceGetPatientCount(currentSearchType, patientListSpinner);
                }
                else {
                    getPatientCount(currentSearchType, patientListSpinner);
                }
            }
        };

        $scope.checkifCagPresentMember = function(patient, isCag, isPresentCagMember){
            if((isPresentCagMember==true && isCag==true) || (isPresentCagMember==undefined && isCag==undefined)){
                $scope.forwardPatient(patient);
            }
            else{
                alert("Not a present cag member!",isCag);
            }
        }

        $scope.forwardPatient = function (patient, heading) {
            var options = $.extend({}, $stateParams);
            $rootScope.patientAdmitLocationStatus = patient.Status;
            $.extend(options, {
                patientUuid: patient.uuid,
                visitUuid: patient.activeVisitUuid || null,
                encounterUuid: $stateParams.encounterUuid || 'active',
                programUuid: patient.programUuid || null,
                enrollment: patient.enrollment || null,
                forwardUrl: patient.forwardUrl || null,
                dateEnrolled: patient.dateEnrolled || null
            });
            var link = options.forwardUrl ? {
                url: options.forwardUrl,
                newTab: true
            } : {url: $scope.search.searchType.forwardUrl, newTab: false};
            if ($scope.search.searchType.links) {
                link = _.find($scope.search.searchType.links, {linkColumn: heading}) || link;
            }
            if (link.url && link.url !== null) {
                $window.open(appService.getAppDescriptor().formatUrl(link.url, options, true), link.newTab ? "_blank" : "_self");
            }
        };
        var getPatientCountSeriallyBySearchIndex = function (index) {
            if (index === $scope.search.searchTypes.length) {
                return;
            }
            var searchType = $scope.search.searchTypes[index];
            if (searchType.handler) {
                var params = {
                    q: searchType.handler,
                    v: "full",
                    location_uuid: $bahmniCookieStore.get(Bahmni.Common.Constants.locationCookieName).uuid,
                    provider_uuid: $rootScope.currentProvider.uuid
                };
                if (searchType.additionalParams) {
                    params["additionalParams"] = searchType.additionalParams;
                }
                patientService.findPatients(params).then(function (response) {
                    searchType.patientCount = response.data.length;
                    if ($scope.search.isSelectedSearch(searchType)) {
                        $scope.search.updatePatientList(response.data);
                    }
                    return getPatientCountSeriallyBySearchIndex(index + 1);
                });
            }
        };
        initialize();
        
    }
]);
