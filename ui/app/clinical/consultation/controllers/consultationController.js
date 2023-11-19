'use strict';

angular.module('bahmni.clinical').controller('ConsultationController',
    ['$scope', '$rootScope', '$state', '$location', '$translate', 'clinicalAppConfigService', 'diagnosisService', 'urlHelper', 'contextChangeHandler',
        'spinner', 'encounterService', 'messagingService', 'sessionService', 'retrospectiveEntryService', 'patientContext', '$q',
        'patientVisitHistoryService', '$stateParams', '$window', 'visitHistory', 'clinicalDashboardConfig', 'appService',
        'ngDialog', '$filter', 'configurations', 'visitConfig', 'conditionsService', 'configurationService', 'auditLogService', 'patientService','observationsService','$timeout',
        function ($scope, $rootScope, $state, $location, $translate, clinicalAppConfigService, diagnosisService, urlHelper, contextChangeHandler,
            spinner, encounterService, messagingService, sessionService, retrospectiveEntryService, patientContext, $q,
            patientVisitHistoryService, $stateParams, $window, visitHistory, clinicalDashboardConfig, appService,
            ngDialog, $filter, configurations, visitConfig, conditionsService, configurationService, auditLogService, patientService,observationsService,$timeout) {
            var DateUtil = Bahmni.Common.Util.DateUtil;
            var getPreviousActiveCondition = Bahmni.Common.Domain.Conditions.getPreviousActiveCondition;
            $scope.togglePrintList = false;
            $scope.patient = patientContext.patient;
            $scope.showDashboardMenu = false;
            $scope.stateChange = function () {
                return $state.current.name === 'patient.dashboard.show';
            };
            $scope.showComment = true;
            $scope.showSaveAndContinueButton = true;
            $scope.isCagMember = true;
            $scope.availableCagId = [];
            $scope.availableCagDetails = [];
            $scope.cagPatient = [];
            $scope.cagPatientObsertions = [];
            $scope.runCagEncounterPostOnce = 0;
            $scope.visitHistory = visitHistory;
            $scope.consultationBoardLink = clinicalAppConfigService.getConsultationBoardLink();
            $scope.showControlPanel = false;
            $scope.clinicalDashboardConfig = clinicalDashboardConfig;
            $scope.showUniqueIDGenerator = false;
            $scope.lastvisited = null;
            $scope.openConsultationInNewTab = function () {
                $window.open('#' + $scope.consultationBoardLink, '_blank');
            };

            $scope.toggleDashboardMenu = function () {
                $scope.showDashboardMenu = !$scope.showDashboardMenu;
            };

            $scope.showDashboard = function (dashboard) {
                if (!clinicalDashboardConfig.isCurrentTab(dashboard)) {
                    $scope.$parent.$broadcast("event:switchDashboard", dashboard);
                }
                $scope.showDashboardMenu = false;
            };

            var setPrintAction = function (event, tab) {
                tab.print = function () {
                    $rootScope.$broadcast(event, tab);
                };
            };
            var setDashboardPrintAction = _.partial(setPrintAction, "event:printDashboard", _);
            var setVisitTabPrintAction = function (tab) {
                tab.print = function () {
                    var url = $state.href('patient.dashboard.visitPrint', {
                        visitUuid: visitHistory.activeVisit.uuid,
                        tab: tab.title,
                        print: 'print'
                    });
                    window.open(url, '_blank');
                };
            };

            _.each(visitConfig.tabs, setVisitTabPrintAction);
            _.each(clinicalDashboardConfig.tabs, setDashboardPrintAction);
            $scope.printList = _.concat(clinicalDashboardConfig.tabs, visitConfig.tabs);

            clinicalDashboardConfig.quickPrints = appService.getAppDescriptor().getConfigValue('quickPrints');
            $scope.printDashboard = function (tab) {
                if (tab) {
                    tab.print();
                } else {
                    clinicalDashboardConfig.currentTab.print();
                }
            };

            $scope.allowConsultation = function () {
                return appService.getAppDescriptor().getConfigValue('allowConsultationWhenNoOpenVisit');
            };

            var setGeneratorVisibility = function () {
                var patientContextConfig = appService.getAppDescriptor().getConfigValue('patientContext') || {};
                $scope.initPromise = patientService.getPatientContext($scope.patient.uuid, $state.params.enrollment, patientContextConfig.personAttributes, patientContextConfig.programAttributes, patientContextConfig.additionalPatientIdentifiers);
                $scope.initPromise.then(function (response) {
                    if (response.data && response.data.additionalPatientIdentifiers) {
                        var patientIdentifiers = response.data.additionalPatientIdentifiers;
                        patientIdentifiers["HIV Program ID"] || patientIdentifiers["New HIV Program ID"] ? $scope.showUniqueIDGenerator = false : $scope.showUniqueIDGenerator = true;
                    }
                });
            };

            $scope.closeDashboard = function (dashboard) {
                clinicalDashboardConfig.closeTab(dashboard);
                $scope.$parent.$parent.$broadcast("event:switchDashboard", clinicalDashboardConfig.currentTab);
            };

            $scope.closeAllDialogs = function () {
                ngDialog.closeAll();
            };

            $scope.availableBoards = [];

            $scope.sharedhealthrecordBoards = [];

            $scope.configName = $stateParams.configName;

            $scope.getTitle = function (board) {
                return $filter('titleTranslate')(board);
            };

            $scope.showBoard = function (boardIndex) {
                $rootScope.collapseControlPanel();
                return buttonClickAction($scope.availableBoards[boardIndex]);
            };

            $scope.gotoPatientDashboard = function () {
                if (!isFormValid()) {
                    $scope.$parent.$parent.$broadcast("event:errorsOnForm");
                    return $q.when({});
                }
                if (contextChangeHandler.execute()["allow"]) {
                    var params = {
                        configName: $scope.configName,
                        patientUuid: patientContext.patient.uuid,
                        encounterUuid: undefined
                    };
                    if ($scope.dashboardDirty) {
                        params['dashboardCachebuster'] = Math.random();
                    }
                    $state.go("patient.dashboard.show", params);
                }
            };

            var isLongerName = function (value) {
                return value ? value.length > 18 : false;
            };

            $scope.getShorterName = function (value) {
                return isLongerName(value) ? value.substring(0, 15) + "..." : value;
            };

            $scope.isInEditEncounterMode = function () {
                return $stateParams.encounterUuid !== undefined && $stateParams.encounterUuid !== 'active';
            };

            $scope.enablePatientSearch = function () {
                return appService.getAppDescriptor().getConfigValue('allowPatientSwitchOnConsultation') === true;
            };

            var setCurrentBoardBasedOnPath = function () {
                var currentPath = $location.url();
                var board = _.find($scope.availableBoards, function (board) {
                    if (board.url === "treatment") {
                        return _.includes(currentPath, board.extensionParams ? board.extensionParams.tabConfigName : board.url);
                    }
                    return _.includes(currentPath, board.url);
                });
                if (board) {
                    $scope.currentBoard = board;
                    $scope.currentBoard.isSelectedTab = true;
                }
            };
            // $scope.getCagPatient = function(){ 

            //     var patientUuid =  $scope.patient.uuid; 
                
            //     appService.getCagPatient(patientUuid)
            //     .then(function(response){
            //         if(response.status == 200){
            //             $scope.isCagMember = true;
            //             console.log("cag Patient data :",response);
            //             $scope.availableCagId = response.data.cagId;
            //             console.log("CAG Id : ",$scope.availableCagId);
            //             var allCags = appService.getAllCags();        
            //             allCags.then(function(response){
            //                 if(response.status == 200){
            //                     $scope.availableCagDetails = response.data.results;
            //                     console.log("all cags : ",$scope.availableCagDetails);
            //                     $scope.availableCagDetails.forEach(function(cag){

            //                     if($scope.availableCagId == cag.id){
            //                         console.log("current cag uuid : ",cag.uuid,cag.id);
            //                         var getCagBelongingToPatient = appService.getCAG(cag.uuid);
            //                         getCagBelongingToPatient.then(function(res){
                                         
            //                             if(res.status == 200){
            //                             console.log("Final Cag patient details : ",res);
            //                             console.log(res.data.cagPatientList);
            //                         }else{
            //                             console.log("An error occured please check you query");
            //                         }
            //                         }).catch(function(error){
            //                             console.error("Error : ",error);
            //                         });
            //                     }                                                                      
            //                 });
            //                 }else{
            //                     console.log("Resource was not found");
            //                 }
            //             }).catch(function(error){
            //                 console.error("Error : ",error);
            //             });
            //         }else{
            //             console.log("Patient is not in any cag");
            //         }
            //     }).catch(function(error){
            //         console.error("Error : ",error);
            //     });
            // }
            /**
             * == look at "encounterService"? and observationService to get the latest encounter and
             * obs for the current patient and apply them to all other members. E.g Start with the first 6 concepts in the consultation form
             * on the save function instantiate the process of getting all the objectivs and assign them to the json obj of the cag.
             */
            
            // observationsService.fetch($scope.patient.uuid, [
            //     "Type of client",
            //     "Appointment scheduled",
            //     "ART, Follow-up date",
            //     "HIVTC, ARV drugs supply duration",
            //     "ARV drugs No. of days dispensed"
            // ], "latest", 1, null, null, null, null)
            // .then(function (res){
            //     console.log("Patient Observations: ",res);
            //     _.each(res,function(obs){
            //         console.log(res.data);
            //         _.each(res.data,function(obsValue){
            //             console.log( obsValue.conceptNameToDisplay,obsValue.valueAsString)
            //         });

            //     })
            // }).catch(function(error){console.log(error)});

            var initialize = function () {
                var appExtensions = clinicalAppConfigService.getAllConsultationBoards();
                var appExtensionsSHR = clinicalAppConfigService.getAllSharedHealthRecordBoards();
                $scope.adtNavigationConfig = { forwardUrl: Bahmni.Clinical.Constants.adtForwardUrl, title: $translate.instant("CLINICAL_GO_TO_DASHBOARD_LABEL"), privilege: Bahmni.Clinical.Constants.adtPrivilege };
                $scope.availableBoards = $scope.availableBoards.concat(appExtensions);
                $scope.sharedhealthrecordBoards = $scope.sharedhealthrecordBoards.concat(appExtensionsSHR);
                $scope.showSaveConfirmDialogConfig = appService.getAppDescriptor().getConfigValue('showSaveConfirmDialog');
                var adtNavigationConfig = appService.getAppDescriptor().getConfigValue('adtNavigationConfig');
                Object.assign($scope.adtNavigationConfig, adtNavigationConfig);
                setCurrentBoardBasedOnPath();
                setGeneratorVisibility();
            };

            $scope.shouldDisplaySaveConfirmDialogForStateChange = function (toState, toParams, fromState, fromParams) {
                if (toState.name.match(/patient.dashboard.show.*/)) {
                    return fromParams.patientUuid != toParams.patientUuid;
                }
                return true;
            };

            var cleanUpListenerStateChangeStart = $scope.$on('$stateChangeStart', function (event, toState, toParams, fromState, fromParams) {
                if ($scope.showSaveConfirmDialogConfig) {
                    if ($rootScope.hasVisitedConsultation && $scope.shouldDisplaySaveConfirmDialogForStateChange(toState, toParams, fromState, fromParams)) {
                        if ($scope.showConfirmationPopUp) {
                            event.preventDefault();
                            spinner.hide(toState.spinnerToken);
                            ngDialog.close();
                            $scope.toStateConfig = { toState: toState, toParams: toParams };
                            $scope.displayConfirmationDialog();
                        }
                    }
                }
                setCurrentBoardBasedOnPath();
            });

            $scope.adtNavigationURL = function (visitUuid) {
                return appService.getAppDescriptor().formatUrl($scope.adtNavigationConfig.forwardUrl, { 'patientUuid': $scope.patient.uuid, 'visitUuid': visitUuid });
            };

            var cleanUpListenerErrorsOnForm = $scope.$on("event:errorsOnForm", function () {
                $scope.showConfirmationPopUp = true;
            });

            $scope.displayConfirmationDialog = function (event) {
                if ($rootScope.hasVisitedConsultation && $scope.showSaveConfirmDialogConfig) {
                    if (event) {
                        event.preventDefault();
                        $scope.targetUrl = event.currentTarget.getAttribute('href');
                    }
                    ngDialog.openConfirm({ template: '../common/ui-helper/views/saveConfirmation.html', scope: $scope });
                }
            };

            var cleanUpListenerStateChangeSuccess = $scope.$on('$stateChangeSuccess', function (event, toState, toParams, fromState) {
                if (toState.name.match(/patient.dashboard.show.+/)) {
                    $rootScope.hasVisitedConsultation = true;
                    $scope.showConfirmationPopUp = true;
                    if ($scope.showSaveConfirmDialogConfig) {
                        $rootScope.$broadcast("event:pageUnload");
                    }
                }
                if ((toState.name === fromState.name) && (fromState.name === "patient.dashboard.show")) {
                    $rootScope.hasVisitedConsultation = false;
                }
            });

            $scope.$on("$destroy", function () {
                cleanUpListenerStateChangeSuccess();
                cleanUpListenerErrorsOnForm();
                cleanUpListenerStateChangeStart();
            });

            $scope.cancelTransition = function () {
                $scope.showConfirmationPopUp = true;
                ngDialog.close();
                delete $scope.targetUrl;
            };

            $scope.saveAndContinue = function () {
                $scope.showConfirmationPopUp = false;
                $scope.save($scope.toStateConfig);
                $window.onbeforeunload = null;
                ngDialog.close();
            };

            $scope.continueWithoutSaving = function () {
                $scope.showConfirmationPopUp = false;
                if ($scope.targetUrl) {
                    $window.open($scope.targetUrl, "_self");
                }
                $window.onbeforeunload = null;
                $state.go($scope.toStateConfig.toState, $scope.toStateConfig.toParams);
                ngDialog.close();
            };

            var getUrl = function (board) {
                var urlPrefix = urlHelper.getPatientUrl();
                var url = "/" + $stateParams.configName + (board.url ? urlPrefix + "/" + board.url : urlPrefix);
                var queryParams = [];
                if ($state.params.encounterUuid) {
                    queryParams.push("encounterUuid=" + $state.params.encounterUuid);
                }
                if ($state.params.programUuid) {
                    queryParams.push("programUuid=" + $state.params.programUuid);
                }

                if ($state.params.enrollment) {
                    queryParams.push("enrollment=" + $state.params.enrollment);
                }

                if ($state.params.dateEnrolled) {
                    queryParams.push("dateEnrolled=" + $state.params.dateEnrolled);
                }

                if ($state.params.dateCompleted) {
                    queryParams.push("dateCompleted=" + $state.params.dateCompleted);
                }

                var extensionParams = board.extensionParams;
                angular.forEach(extensionParams, function (extensionParamValue, extensionParamKey) {
                    queryParams.push(extensionParamKey + "=" + extensionParamValue);
                });

                if (!_.isEmpty(queryParams)) {
                    url = url + "?" + queryParams.join("&");
                }
                if (board.extensionPointId !== 'org.bahmni.clinical.sharedhealthrecord.board') {
                    $scope.lastConsultationTabUrl.url = url;
                }
                return $location.url(url);
            };

            $scope.openConsultation = function () {
                appService.setRegimen('');
                appService.setActive(null);
                appService.setDeactivated(null);
                appService.setOrderstatus(null);

                if ($scope.showSaveConfirmDialogConfig) {
                    $rootScope.$broadcast("event:pageUnload");
                }
                $scope.closeAllDialogs();
                $scope.collapseControlPanel();
                $rootScope.hasVisitedConsultation = true;
                switchToConsultationTab();
            };

            $scope.opensharedhealthrecord = function () {
                if ($scope.showSaveConfirmDialogConfig) {
                    $rootScope.$broadcast("event:pageUnload");
                }
                $scope.closeAllDialogs();
                $scope.collapseControlPanel();
                switchToSharedHealthRecordTab();
            };

            $scope.generateAssignPatientId = function () {
                spinner.forPromise(patientService.generateIdentifier()
                    .then(function (result) {
                        return result.data;
                    }).then(function (assignedIdentifier) {
                        return patientService.assignIdentifier($scope.patient.uuid, assignedIdentifier, "New HIV Program ID");
                    }).then(function (assignedMessage) {
                        var current = $state.current;
                        var params = angular.copy($stateParams);
                        $state.transitionTo(current, params, { reload: true, inherit: true, notify: true });
                    }).catch(function (error) {
                        messagingService.showMessage('error', error);
                    }));
            };
            $scope.isCurrentUrlShr = function () {
                var currentUrl = $location.path();
                return _($location.path()).includes("/shared-health-record/search") ? true : false;
            };

            var switchToConsultationTab = function () {
                if ($scope.lastConsultationTabUrl.url) {
                    $location.url($scope.lastConsultationTabUrl.url);
                } else {
                    // Default tab
                    getUrl($scope.availableBoards[0]);
                }
            };
            var switchToSharedHealthRecordTab = function () {
                $location.url("/shared-health-record/search");
                getUrl($scope.sharedhealthrecordBoards[0]);
            };

            var contextChange = function () {
                return contextChangeHandler.execute();
            };

            var buttonClickAction = function (board) {
                if ($scope.currentBoard === board) {
                    return;
                }
                if (!isFormValid()) {
                    $scope.$parent.$broadcast("event:errorsOnForm");
                    return;
                }

                contextChangeHandler.reset();
                _.map($scope.availableBoards, function (availableBoard) {
                    availableBoard.isSelectedTab = false;
                });

                $scope.currentBoard = board;
                $scope.currentBoard.isSelectedTab = true;
                return getUrl(board);
            };

            var preSavePromise = function () {
                var deferred = $q.defer();

                var observationFilter = new Bahmni.Common.Domain.ObservationFilter();
                $scope.consultation.preSaveHandler.fire();
                $scope.lastvisited = $scope.consultation.lastvisited;
                var selectedObsTemplate = $scope.consultation.selectedObsTemplate;
                var tempConsultation = angular.copy($scope.consultation);
                tempConsultation.observations = observationFilter.filter(tempConsultation.observations);
                tempConsultation.consultationNote = observationFilter.filter([tempConsultation.consultationNote])[0];
                tempConsultation.labOrderNote = observationFilter.filter([tempConsultation.labOrderNote])[0];

                addFormObservations(tempConsultation);
                storeTemplatePreference(selectedObsTemplate);
                var visitTypeForRetrospectiveEntries = clinicalAppConfigService.getVisitTypeForRetrospectiveEntries();
                var defaultVisitType = clinicalAppConfigService.getDefaultVisitType();
                var encounterData = new Bahmni.Clinical.EncounterTransactionMapper().map(tempConsultation, $scope.patient, sessionService.getLoginLocationUuid(), retrospectiveEntryService.getRetrospectiveEntry(),
                    visitTypeForRetrospectiveEntries, defaultVisitType, $scope.isInEditEncounterMode(), $state.params.enrollment);
                deferred.resolve(encounterData);
                return deferred.promise;
            };

            var saveConditions = function () {
                return conditionsService.save($scope.consultation.conditions, $scope.patient.uuid)
                    .then(function () {
                        return conditionsService.getConditions($scope.patient.uuid);
                    }).then(function (savedConditions) {
                        return savedConditions;
                    });
            };

            var storeTemplatePreference = function (selectedObsTemplate) {
                var templates = [];
                _.each(selectedObsTemplate, function (template) {
                    var templateName = template.formName || template.conceptName;
                    var isTemplateAlreadyPresent = _.find(templates, function (template) {
                        return template === templateName;
                    });
                    if (_.isUndefined(isTemplateAlreadyPresent)) {
                        templates.push(templateName);
                    }
                });

                var data = {
                    "patientUuid": $scope.patient.uuid,
                    "providerUuid": $rootScope.currentProvider.uuid,
                    "templates": templates
                };

                if (!_.isEmpty(templates)) {
                    localStorage.setItem("templatePreference", JSON.stringify(data));
                }
            };

            var discontinuedDrugOrderValidation = function (removableDrugs) {
                var discontinuedDrugOrderValidationMessage;
                _.find(removableDrugs, function (drugOrder) {
                    if (!drugOrder.dateStopped) {
                        if (drugOrder._effectiveStartDate < moment()) {
                            discontinuedDrugOrderValidationMessage = "Please make sure that " + drugOrder.concept.name + " has a stop date between " + DateUtil.getDateWithoutTime(drugOrder._effectiveStartDate) + " and " + DateUtil.getDateWithoutTime(DateUtil.now());
                            return true;
                        } else {
                            discontinuedDrugOrderValidationMessage = drugOrder.concept.name + " should have stop date as today's date since it is a future drug order";
                            return true;
                        }
                    }
                });
                return discontinuedDrugOrderValidationMessage;
            };

            var addFormObservations = function (tempConsultation) {
                if (tempConsultation.observationForms) {
                    _.remove(tempConsultation.observations, function (observation) {
                        return observation.formNamespace;
                    });
                    _.each(tempConsultation.observationForms, function (observationForm) {
                        if (observationForm.component) {
                            var formObservations = observationForm.component.getValue();
                            _.each(formObservations.observations, function (obs) {
                                tempConsultation.observations.push(obs);
                            });
                        }
                    });
                }
            };

            var isObservationFormValid = function () {
                var valid = true;
                _.each($scope.consultation.observationForms, function (observationForm) {
                    if (valid && observationForm.component) {
                        var value = observationForm.component.getValue();
                        if (value.errors) {
                            messagingService.showMessage('error', "{{'CLINICAL_FORM_ERRORS_MESSAGE_KEY' | translate }}");
                            valid = false;
                        }
                    }
                });
                return valid;
            };

            var isFormValid = function () {
                var contxChange = contextChange();
                var shouldAllow = contxChange["allow"];
                var discontinuedDrugOrderValidationMessage = discontinuedDrugOrderValidation($scope.consultation.discontinuedDrugs);
                if (!shouldAllow) {
                    var errorMessage = contxChange["errorMessage"] ? contxChange["errorMessage"] : "{{'CLINICAL_FORM_ERRORS_MESSAGE_KEY' | translate }}";
                    messagingService.showMessage('error', errorMessage);
                } else if (discontinuedDrugOrderValidationMessage) {
                    var errorMessage = discontinuedDrugOrderValidationMessage;
                    messagingService.showMessage('error', errorMessage);
                }
                return shouldAllow && !discontinuedDrugOrderValidationMessage && isObservationFormValid();
            };

            var copyConsultationToScope = function (consultationWithDiagnosis) {
                consultationWithDiagnosis.preSaveHandler = $scope.consultation.preSaveHandler;
                consultationWithDiagnosis.postSaveHandler = $scope.consultation.postSaveHandler;
                $scope.$parent.consultation = consultationWithDiagnosis;
                $scope.$parent.consultation.postSaveHandler.fire();
                $scope.dashboardDirty = true;
            };

            $scope.save = function (toStateConfig) {
                appService.setOrderstatus(true);
                if (!isFormValid()) {
                    $scope.$parent.$parent.$broadcast("event:errorsOnForm");
                    return $q.when({});
                }
                return spinner.forPromise($q.all([preSavePromise(), encounterService.getEncounterType($state.params.programUuid, sessionService.getLoginLocationUuid())])
                .then(function (results) {
                    console.log("Results : ",results);
                    var encounterData = results[0];
                    encounterData.encounterTypeUuid = results[1].uuid;
                    var params = angular.copy($state.params);
                    params.cachebuster = Math.random();

                    $scope.visitUuid =  results[0].visitUuid;
                    $scope.visitType = results[0].visitType;
                    $scope.encounterDateTime = results[0].encounterDateTime; 
                    $scope.encounterTypeUuid = results[0].encounterTypeUuid; 
                    $scope.locationUuid = results[0].locationUuid; 

                    return encounterService.create(encounterData)
                        .then(function (saveResponse) {
                            var messageParams = { encounterUuid: saveResponse.data.encounterUuid, encounterType: saveResponse.data.encounterType };
                            auditLogService.log($scope.patient.uuid, "EDIT_ENCOUNTER", messageParams, "MODULE_LABEL_CLINICAL_KEY");
                            var consultationMapper = new Bahmni.ConsultationMapper(configurations.dosageFrequencyConfig(), configurations.dosageInstructionConfig(),
                                configurations.consultationNoteConcept(), configurations.labOrderNotesConcept(), $scope.followUpConditionConcept);
                            var consultation = consultationMapper.map(saveResponse.data);
                            consultation.lastvisited = $scope.lastvisited;
                            return consultation;
                        }).then(function (savedConsultation) {
                            console.log("savedConsultation : ",savedConsultation);
                            return spinner.forPromise(diagnosisService.populateDiagnosisInformation($scope.patient.uuid, savedConsultation)
                                .then(function (consultationWithDiagnosis) {
                                    return saveConditions().then(function (savedConditions) {
                                        consultationWithDiagnosis.conditions = savedConditions;
                                        messagingService.showMessage('info', "{{'CLINICAL_SAVE_SUCCESS_MESSAGE_KEY' | translate}}");
                                    }, function () {
                                        consultationWithDiagnosis.conditions = $scope.consultation.conditions;
                                    }).then(function () {
                                        copyConsultationToScope(consultationWithDiagnosis);
                                        if ($scope.targetUrl) {
                                            return $window.open($scope.targetUrl, "_self");
                                        }
                                        return $state.transitionTo(toStateConfig ? toStateConfig.toState : $state.current, toStateConfig ? toStateConfig.toParams : params, {
                                            inherit: false,
                                            notify: true,
                                            reload: (toStateConfig !== undefined)
                                        });
                                    });
                                }));
                        }).then(function(){
                            // Manupulate data to be posted to the cag Encounter
                            /**
                             * 1st create an object associated with the main patient.
                             * 2nd assign observations attained from the current patient especially for common observation for all ART Follow Up
                             * Inject the $timeout service. To await all other observations to be store in other to call the post to cag encounter with the currrent patient
                             * observation .
                             * This funtion should not return a object since we are going to post to the end point
                             */
                            // StartTimeOut
                            $timeout(function(){                                

                            var patientUuid =  $scope.patient.uuid; 
                                    
                            appService.getCagPatient(patientUuid)
                            .then(function(response){
                                if(response.status == 200 ){
                                    $scope.isCagMember = true;
                                    console.log("cag Patient data :",response);
                                    $scope.availableCagId = response.data.cagId;
                                    console.log("CAG Id : ",$scope.availableCagId);
                                    var allCags = appService.getAllCags();        
                                    allCags.then(function(response){
                                        if(response.status == 200){
                                            $scope.availableCagDetails = response.data.results;
                                            console.log("all cags : ",$scope.availableCagDetails);
                                            $scope.availableCagDetails.forEach(function(cag){
            
                                            if($scope.availableCagId == cag.id){
                                                console.log("current cag uuid : ",cag.uuid,cag.id);
                                                $scope.cagUuid = cag.uuid;
                                                var getCagBelongingToPatient = appService.getCAG(cag.uuid);
                                                getCagBelongingToPatient.then(function(res){
                                                        
                                                    if(res.status == 200){
                                                    console.log("Final Cag patient details : ",res);
                                                    console.log("CagPatient List ",res.data.cagPatientList);
                                                    // Get the latest observations for the current patient in order to create an object 
                                                        observationsService.fetch($scope.patient.uuid, [
                                                            "Type of client",
                                                            "Appointment scheduled",
                                                            "ART, Follow-up date",
                                                            "HIVTC, ARV drugs supply duration",
                                                            "ARV drugs No. of days dispensed"
                                                        ], "latest", 1, null, null, null, null)
                                                        .then(function (res){                                                                     
                                                            console.log("Patient Observations : ",res);
                                                            $scope.data = res.data;
                                                            $scope.data.forEach(function(response){
                                                            //console.log("Values : ",response.conceptNameToDisplay, response.valueAsString);
                                                            console.log(response);
                                                            $scope.cagEncounterDefaultData = setDefaultCagEncounterValues($scope.cagUuid, $scope.visitUuid, $scope.encounterDateTime, $scope.encounterTypeUuid, $scope.locationUuid, $scope.patient.uuid );
                                                            
                                                                if($scope.runCagEncounterPostOnce == 0){
                                                                    console.log("once") 
                                                                    /**
                                                                     * we want to get the observations for the current use and create the first object
                                                                     * for the obs: [ob1,obj2]
                                                                     */
                                                                    $scope.runCagEncounterPostOnce=+1;
                                                                }else{

                                                                    // next we need to update the cagEncounter with the other member list [?????]
                                                                    console.log("twoo")
                                                                    $scope.runCagEncounterPostOnce=+1;
                                                                }
                                                            });                                                                    
                                                
                                                        }).catch(function(error){console.log(error)});
                                                }else{
                                                    console.error();("An error occured please check you query");
                                                }
                                                }).catch(function(error){
                                                    console.error("Error : ",error);
                                                });
                                            }                                                                      
                                        });
                                        }else{
                                            console.log("Resource was not found");
                                        }
                                    }).catch(function(error){
                                        console.error("Error : ",error);
                                    });
                                }else{
                                    console.log("Patient is not in any cag");
                                }
                            }
                            ).catch(function(error){
                                console.log("Error : ",error);
                            });                            
                            // EndTimeOut
                        },2000);
                    }).catch(function (error) {
                        var message = Bahmni.Clinical.Error.translate(error) || "{{'CLINICAL_SAVE_FAILURE_MESSAGE_KEY' | translate}}";
                        messagingService.showMessage('error', message);
                    });
                }));
            }; 

            var setDefaultCagEncounterValues = function(cagUuid, cagVisitUuid, cagEncounterDate, nextCagEncounterDate, locationUuid, attenderUuid){
                
                const cagData = 
                    {
                        cag: {
                            uuid: cagUuid
                        },
                        cagVisit: {
                            uuid: cagVisitUuid
                        },
                        cagEncounterDatetTime: cagEncounterDate,// "2023-11-12 18:40:16",
                        nextEncounterDate: nextCagEncounterDate,// "2023-12-12 23:59:59",
                        location: {
                            uuid: locationUuid //"8d6c993e-c2cc-11de-8d13-0010c6dffd0f"
                        },
                        attender: {
                            uuid: attenderUuid //"af4726dd-ba5b-456c-b30e-d30ef3893242"
                        },
                    };
            
                return cagData;
                
            }
            initialize();
        }]);
