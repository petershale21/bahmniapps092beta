'use strict';

angular.module('bahmni.clinical')
    .controller('PatientDashboardController', ['$scope', 'clinicalAppConfigService', 'clinicalDashboardConfig', 'printer',
        '$state', 'spinner', 'visitSummary', 'appService',  'messagingService','observationsService','$stateParams', 'diseaseTemplateService', 'patientContext', '$location', '$filter','$q',
        function ($scope, clinicalAppConfigService, clinicalDashboardConfig, printer,
                  $state, spinner, visitSummary, appService, messagingService, observationsService,$stateParams, diseaseTemplateService, patientContext, $location, $filter, $q) {
            $scope.patient = patientContext.patient;
            $scope.activeVisit = $scope.visitHistory.activeVisit;
            $scope.activeVisitData = {};
            $scope.obsIgnoreList = clinicalAppConfigService.getObsIgnoreList();
            $scope.clinicalDashboardConfig = clinicalDashboardConfig;
            $scope.visitSummary = visitSummary;
            $scope.enrollment = $stateParams.enrollment;
            $scope.isDashboardPrinting = false;
            var programConfig = appService.getAppDescriptor().getConfigValue("program") || {};
``
            $scope.stateChange = function () {
                return $state.current.name === 'patient.dashboard.show';
            };

            var cleanUpListenerSwitchDashboard = $scope.$on("event:switchDashboard", function (event, dashboard) {
                $scope.init(dashboard);
            });

            var cleanUpListenerPrintDashboard = $scope.$on("event:printDashboard", function (event, tab) {
                var printScope = $scope.$new();
                printScope.isDashboardPrinting = true;
                printScope.tabBeingPrinted = tab || clinicalDashboardConfig.currentTab;
                var dashboardModel = Bahmni.Common.DisplayControl.Dashboard.create(printScope.tabBeingPrinted, $filter);
                spinner.forPromise(diseaseTemplateService.getLatestDiseaseTemplates(
                    $stateParams.patientUuid,
                    clinicalDashboardConfig.getDiseaseTemplateSections(printScope.tabBeingPrinted),
                    null,
                    null
                ).then(function (diseaseTemplate) {
                    printScope.diseaseTemplates = diseaseTemplate;
                    printScope.sectionGroups = dashboardModel.getSections(printScope.diseaseTemplates);
                    printer.printFromScope('dashboard/views/dashboardPrint.html', printScope);
                }));
            });

            $scope.$on("$destroy", function () {
                cleanUpListenerSwitchDashboard();
                cleanUpListenerPrintDashboard();
            });

            var addTabNameToParams = function (board) {
                $location.search('currentTab', board.translationKey);
            };
            var getARTStartDate = function () {
                                return $q.all([observationsService.fetch($scope.patient.uuid, "HIVTC, ART start date", "initial"),
                                    observationsService.fetch($scope.patient.uuid, [
                                        "HIVTC, Viral Load Blood drawn date",
                                        "HIVTC, Treatment substituted date",
                                        "HIVTC, Treatment switched date"],
                                        "latest")]);
                            };
            var getPregnancyStatus = function() {
                return observationsService.fetch($scope.patient.uuid, "ANC, Estimated Date of Delivery", "latest")
                    .then(function(result) {
                    // Return the result of the fetch() method call
                    return result;
                    })
                    .catch(function(error) {
                    // Handle the error
                    console.error('Error:', error);
                    // Rethrow the error to propagate it up the promise chain
                    throw error;
                    });
        };

            
             getPregnancyStatus().then(function (result){
                
                var rawEDD;
                try {
                    rawEDD = result.data[0].valueAsString
                  }
                  catch(err) {
                    //Nothing
                  }
                if(rawEDD){
                    var edd = Bahmni.Common.Util.DateUtil.parseServerDateToDate(rawEDD);
                    var today = Bahmni.Common.Util.DateUtil.now();
                
                    getARTStartDate().then(function (result) {
                        if (result[0].data.length > 0 || result[1].data.length > 0) {
                            var lastDateSpecimenCollected = _.find(result[1].data, function (observation) {
                                return observation.concept.name === "HIVTC, Viral Load Blood drawn date";
                            });
                            var lastBloodDrawDate = Bahmni.Common.Util.DateUtil.parseServerDateToDate(lastDateSpecimenCollected.value);
                             //Determining if the client is still pregnant.
                            if(Bahmni.Common.Util.DateUtil.isBeforeDate(today,edd)){

                                var diffInDays = Bahmni.Common.Util.DateUtil.diffInDays(lastBloodDrawDate, today);
                                // console.log(lastBloodDrawDate, today, diffInDays)
                                if (diffInDays > 90){
                                    console.log('show reminder')
                                    messagingService.showMessage('reminder', "Patient is due for ANC trimonthly Viral Load blood draw");
                                }

                            }
                        } 
                    })
                   
                } 
                
                
            })
           
            
            var getCurrentTab = function () {
                var currentTabKey = $location.search().currentTab;
                var currentTab = $state.current.dashboard;
                if (currentTabKey) {
                    currentTab = _.find(clinicalDashboardConfig.visibleTabs, function (tab) {
                        return tab.translationKey === currentTabKey;
                    });
                }
                return (currentTab != undefined ? currentTab : clinicalDashboardConfig.currentTab);
            };

            var determineReferenceDate = function (artStartDate, treatmentSubstitutionDate, treatmentSwitchDate) {
                                
                                var referenceObject = { referenceDate: "", referenceState: "" };
                                if (artStartDate && !treatmentSubstitutionDate && !treatmentSwitchDate) {
                                    referenceObject.referenceDate = artStartDate;
                                    referenceObject.referenceState = "ART Initiation";
                                } else if (artStartDate && treatmentSubstitutionDate && !treatmentSwitchDate) {
                                    referenceObject.referenceDate = treatmentSubstitutionDate;
                                    referenceObject.referenceState = "Treatment Substitution";
                                } else if (artStartDate && !treatmentSubstitutionDate && treatmentSwitchDate) {
                                    referenceObject.referenceDate = treatmentSwitchDate;
                                    referenceObject.referenceState = "Treatment Switch";
                                } else if (artStartDate && treatmentSubstitutionDate && treatmentSwitchDate) {
                                    if (Bahmni.Common.Util.DateUtil.isBeforeDate(treatmentSwitchDate, treatmentSubstitutionDate)) {
                                        referenceObject.referenceDate = treatmentSubstitutionDate;
                                        referenceObject.referenceState = "Treatment Substitution";
                                    } else {
                                        referenceObject.referenceDate = treatmentSwitchDate;
                                        referenceObject.referenceState = "Treatment Switch";
                                    }
                                } else {
                                    // Nothing
                                }
                                return referenceObject;
                            };

            $scope.init = function (dashboard) {
                dashboard.startDate = null;
                dashboard.endDate = null;
                if (programConfig.showDetailsWithinDateRange) {
                    dashboard.startDate = $stateParams.dateEnrolled;
                    dashboard.endDate = $stateParams.dateCompleted;
                }
                $state.current.dashboard = dashboard;
                clinicalDashboardConfig.switchTab(dashboard);
                addTabNameToParams(dashboard);
                var dashboardModel = Bahmni.Common.DisplayControl.Dashboard.create(dashboard, $filter);
                diseaseTemplateService.getLatestDiseaseTemplates(
                    $stateParams.patientUuid, clinicalDashboardConfig.getDiseaseTemplateSections(), dashboard.startDate, dashboard.endDate).then(function (diseaseTemplate) {
                        $scope.diseaseTemplates = diseaseTemplate;
                        $scope.sectionGroups = dashboardModel.getSections($scope.diseaseTemplates);

            getARTStartDate().then(function (result) {
                                if (result[0].data.length > 0 || result[1].data.length > 0) {
                                    var today = Bahmni.Common.Util.DateUtil.now();
                                    var artStartDate = result[0].data.length > 0 ?
                                    Bahmni.Common.Util.DateUtil.parseServerDateToDate(result[0].data[0].valueAsString) : null;
                                    var lastDateSpecimenCollected = _.find(result[1].data, function (observation) {
                                        return observation.concept.name === "HIVTC, Viral Load Blood drawn date";
                                    });
                                    var treatmentSwitch = _.find(result[1].data, function (observation) {
                                        return observation.concept.name === "HIVTC, Treatment switched date";
                                    });
                                    var treatmentSubstitution = _.find(result[1].data, function (observation) {
                                        return observation.concept.name === "HIVTC, Treatment substituted date";
                                    });
                                    var treatmentSubstitutionDate = treatmentSubstitution ?
                                    Bahmni.Common.Util.DateUtil.parseServerDateToDate(treatmentSubstitution.valueAsString) : null;
                                    var treatmentSwitchDate = treatmentSwitch ?
                                    Bahmni.Common.Util.DateUtil.parseServerDateToDate(treatmentSwitch.valueAsString) : null;
                                    var referenceObject = determineReferenceDate(artStartDate, treatmentSubstitutionDate, treatmentSwitchDate);
                                    var dateDiffinDays = Bahmni.Common.Util.DateUtil.diffInDays(referenceObject.referenceDate, today);
                                    var dateDiffInMonthsFloor = Math.floor((dateDiffinDays * 12) / 365);
                                    var dateDiffinMonthsCeil = Math.ceil((dateDiffinDays * 12) / 365);
                                    // If the difference between today and the reference date does not exceed 12 months
                                    if (dateDiffinDays > 0 && dateDiffinDays <= 365) {
                                        // After every 6 months and if no blood was drawn 1 month prior to the encounter date
                                        if (dateDiffInMonthsFloor > 0 && dateDiffinMonthsCeil > 0) {
                                            if (dateDiffInMonthsFloor % 6 == 0 || dateDiffinMonthsCeil % 6 == 0) {
                                                if (lastDateSpecimenCollected) {
                                                    var recentBloodDrawDate = Bahmni.Common.Util.DateUtil.parseServerDateToDate(lastDateSpecimenCollected.valueAsString);
                                                    var recentVLBloodDrawDiff = Bahmni.Common.Util.DateUtil.diffInDays(recentBloodDrawDate, today);
                                                    if (recentVLBloodDrawDiff > 0 && !(recentVLBloodDrawDiff <= 31)) {
                                                        messagingService.showMessage('reminder', "Patient is due for 6 monthly Viral Load blood draw, since "
                                                        + referenceObject.referenceState);
                                                    }
                                                } else {
                                                    messagingService.showMessage('reminder', "Patient is due for 6 monthly Viral Load blood draw, since "
                                                    + referenceObject.referenceState);
                                                }
                                            }
                                        }
                                    } else if (dateDiffinDays > 365) {
                                        // After every 12 months and if no blood was drawn 1 month prior to the encounter date
                                        if (dateDiffInMonthsFloor % 12 == 0 || dateDiffinMonthsCeil % 12 == 0) {
                                            if (lastDateSpecimenCollected) {
                                                var recentBloodDrawDate = Bahmni.Common.Util.DateUtil.parseServerDateToDate(lastDateSpecimenCollected.valueAsString);
                                                var recentVLBloodDrawDiff = Bahmni.Common.Util.DateUtil.diffInDays(recentBloodDrawDate, today);
                                                if (recentVLBloodDrawDiff > 0 && !(recentVLBloodDrawDiff <= 31)) {
                                                    messagingService.showMessage('reminder', "Patient is due for 12 monthly Viral Load blood draw, since "
                                                    + referenceObject.referenceState);
                                                }
                                            } else {
                                                messagingService.showMessage('reminder', "Patient is due for 12 monthly Viral Load blood draw, since "
                                                + referenceObject.referenceState);
                                            }
                                        }
                                    }
                                }
                            });


                                                    

                    });
                $scope.currentDashboardTemplateUrl = $state.current.views['dashboard-content'] ?
                    $state.current.views['dashboard-content'].templateUrl : $state.current.views['dashboard-content'];
            };

            $scope.init(getCurrentTab());
        }]);
