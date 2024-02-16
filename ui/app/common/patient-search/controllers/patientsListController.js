'use strict';

angular.module('bahmni.common.patientSearch')
.controller('PatientsListController', ['$scope', '$window', 'patientService', '$rootScope', 'appService', 'spinner',
    '$stateParams', '$bahmniCookieStore', 'printer', 'configurationService', '$q',
    function ($scope, $window, patientService, $rootScope, appService, spinner, $stateParams, $bahmniCookieStore, printer, configurationService, $q) {
        const DEFAULT_FETCH_DELAY = 2000;
        var patientSearchConfig = appService.getAppDescriptor().getConfigValue("patientSearch");
        console.log(patientSearchConfig);
        var patientListSpinner;
        var count = 0;
        $scope.activeVisits = [];
        $scope.otherCagMemberList=[];
        $scope.totalqueueLimit=0;
        var initialize = function () {
            var searchTypes = appService.getAppDescriptor().getExtensions("org.bahmni.patient.search", "config").map(mapExtensionToSearchType);
            $scope.search = new Bahmni.Common.PatientSearch.Search(_.without(searchTypes, undefined));
            $scope.search.markPatientEntry();
            $scope.$watch('search.searchType', function (currentSearchType) {
                _.isEmpty(currentSearchType) || fetchPatients(currentSearchType);
                console.log($scope.search.searchTypes);
                console.log(getPatientCount($scope.search.searchTypes[0], null));
            });
            $scope.$watch('search.activePatients', function () {
                if ($scope.search.activePatients.length > 0 && $scope.search.activePatients[0].activeVisitUuid) {
                    $scope.totalqueueLimit=$scope.search.searchTypes[0].patientCount;
                    console.log("active === ", $scope.search.activePatients, "searchtypes ===",$scope.search);
                    // if($scope.search.activePatients)
                    $scope.isCagType($scope.totalqueueLimit);
                    $scope.otherCagMemberList=[];
                    hideSpinner(spinner, patientListSpinner, $(".tab-content"));
                }
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

        $scope.isCagVisit = function(uuid, activePatientsUuid, index){
            var deferred = $q.defer();
            appService.getCagPatient(uuid).then(function(response){
                console.log(response);
                var res={
                    "status" : false,
                    "index" : index,
                    "cagName":undefined,
                    "otherMemberList":[]
                }
                if(response.data.activeCagVisits.length > 0){
                    if(response.data.activeCagVisits[response.data.activeCagVisits.length-1].attender.uuid==activePatientsUuid) {
                        res.status=true;
                        res.cagName=response.data.activeCagVisits[response.data.activeCagVisits.length-1].cag.name;
                        res.otherMemberList=response.data.activeCagVisits[response.data.activeCagVisits.length-1].visits;
                        deferred.resolve(res);
                    }
                    else deferred.resolve(res);
                }
                else deferred.resolve(res);
                deferred.resolve();
            })
            return deferred.promise;
        }

        $scope.isCagType = function(limit){
            console.log($scope.search);
            
            appService.getIsCAGVisitType(limit).then(function(response){
                $scope.activeVisits = response.data.results;

                console.log($scope.activeVisits);
                for(var i=0;i<limit;i++){
                    var found = 0;
                    var uuid = "";
                    for(var j=0; j<$scope.activeVisits.length; j++){
                        try{
                            if($scope.search.activePatients[i].activeVisitUuid == $scope.activeVisits[j].uuid && $scope.activeVisits[j].display.substring(0,3)=="CAG"){
                                $scope.search.activePatients[i]['showIsCag'] = true;
                                $scope.search.activePatients[i]['presentMember'] = false;
                                $scope.search.activePatients[i]['cagName'] = "";
                                found=1;
                                j=$scope.activeVisits.length;
                                uuid=$scope.search.activePatients[i].uuid;
                                console.log($scope.search.activePatients);
                                console.log(i,);
                            }
                        }catch (Exception) {
                            // console.error(`Couldn't insert card ${x}`);
                          }
                        
                    }
                    
                    if(uuid!=""){
                        var pos=i;
                        $q.all([$scope.isCagVisit(uuid, $scope.search.activePatients[i].uuid, pos)]).then(function(res){
                            if(res){
                                console.log(res[0],i,$scope.otherCagMemberList);
                                if(res[0].status)   $scope.search.activePatients[res[0].index].presentMember = res[0].status;
                                if(res[0].cagName!=undefined)  $scope.search.activePatients[res[0].index].cagName = res[0].cagName;
                                if(res[0].otherMemberList.length==0)  $scope.otherCagMemberList.push({"uuid":$scope.search.activePatients[res[0].index].uuid,"index":res[0].index}) 
                                // for (let k = 0; k < $scope.otherCagMemberList.length; k++) {
                                //     console.log( $scope.otherCagMemberList, k,res[0].otherMemberList,$scope.search.activePatients );
                                //     for(let j=0; j<res[0].otherMemberList.length; j++){
                                //         if( $scope.otherCagMemberList[k].uuid== res[0].otherMemberList[j].patient.uuid) {
                                //             console.log( $scope.otherCagMemberList, k,$scope.search.activePatients ,res[0].cagname,$scope.otherCagMemberList[k].index);
                                //             $scope.search.activePatients[$scope.otherCagMemberList[k].index].cagName = $scope.search.activePatients[res[0].index].cagName;
                                        
                                //         }  
                                //     } 
                                // }

                                // for(let j=0; j<res[0].otherMemberList.length; j++){
                                //     for (let k = 0; k < $scope.search.activePatients.length; k++) {
                                //         // console.log( $scope.otherCagMemberList, k,res[0].otherMemberList,$scope.search.activePatients );
                                    
                                //         if( $scope.search.activePatients[k].uuid== res[0].otherMemberList[j].patient.uuid && $scope.search.activePatients[k].cagName=="") {
                                //             // console.log( $scope.otherCagMemberList, k,$scope.search.activePatients ,res[0].cagname,$scope.otherCagMemberList[k].index);
                                //             $scope.search.activePatients[k].cagName = res[0].cagName;
                                        
                                //         }  
                                //     } 
                                // }
                            }
                        })
                    }
                }
            });
           
        }
        
        $scope.searchPatients = function () {
            return spinner.forPromise(patientService.search($scope.search.searchParameter)).then(function (response) {
                $scope.search.updateSearchResults(response.data.pageOfResults);
                if ($scope.search.hasSingleActivePatient()) {
                    $scope.forwardPatient($scope.search.activePatients[0]);
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
