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
            // DateFormat df = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'");
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
            $scope.cagPatientVisitList = {};
            $scope.patientVisitData = []// Other 
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

            $scope.fetchPrevRegimen = function (patientUuids,visitUuid) {
                console.log("===", patientUuids);
                var deferred = $q.defer();
                observationsService.fetch(patientUuids, [
                    "HIVTC, ART Regimen"
                ], "latest")
                .then(function (response){  
                    if(response.data.length>0){
                        console.log("Response data : : : ",response);
                        var patientRegimen = response.data[0].value.name;
                        var patientRegimenUuid = response.data[0].value.uuid;
                        var patientVisitData = 
                        { 
                            "patientUuid" : patientUuids,
                            "patientVisitUuid" : visitUuid,
                            "patientRegimen": patientRegimen,
                            "patientRegimenUuid": patientRegimenUuid
                        };
                        console.log("inner loop: ",patientVisitData);
                        
                        $scope.patientVisitData.push(
                            patientVisitData
                        );  
                        console.log("patientVisitData = ", $scope.patientVisitData);
                        deferred.resolve(true);
                    } 
                    else{
                        var patientVisitData = 
                        { 
                            "patientUuid" : patientUuids,
                            "patientVisitUuid" : visitUuid,
                            "patientRegimen": "",
                            "patientRegimenUuid": ""
                        };
                        console.log("inner loop: ",patientVisitData);
                        
                        $scope.patientVisitData.push(
                            patientVisitData
                        );  
                        console.log("patientVisitData = ", $scope.patientVisitData);
                        deferred.resolve(true);
                    }
                    
                }).catch(function(error){console.log(error)}); 
                return deferred.promise;
            }

            $scope.fetchPrevObsData = function (patientUuids) {
                console.log("===", patientUuids);
                var deferred = $q.defer();
                observationsService.fetch(patientUuids, [
                    "Type of client",
                    // "Appointment scheduled",
                    "ART, Follow-up date",
                    // "HIVTC, ARV drugs supply duration",
                    // "ARV drugs No. of days dispensed", 
                    "HIVTC, HIV care WHO Staging",
                    // "Cotrimoxazole adherence",
                    // "Cotrimoxazole No of days dispensed"
                ], "latest",1)
                .then(function (response){
                    console.log(response)   
                    deferred.resolve(response)
                    
                }).catch(function(error){console.log(error)}); 
                return deferred.promise;
            }

            $scope.isCagVisit = function(uuid){
                var deferred = $q.defer();
                appService.getCagPatient(uuid).then(function(response){
                    console.log(response);
                    if(response.data.activeCagVisits.length == 1){
                        deferred.resolve(true);
                    }
                    else{
                        deferred.resolve(false);
                    }
                })
                return deferred.promise;
            }

            $scope.save = function (toStateConfig) {
                appService.setOrderstatus(true);
                if (!isFormValid()) {
                    $scope.$parent.$parent.$broadcast("event:errorsOnForm");
                    return $q.when({});
                }
                return $q.all([ $scope.isCagVisit($scope.patient.uuid)]).then(function(results){
                    console.log(results);
                    if(results[0] == true){
                        var patientUuid =  $scope.patient.uuid;      
                        appService.getCagPatient(patientUuid)
                        .then(function(response){
                            if(response.status == 200 ){
                                
                                var visitData = response.data;
                                
                                //console.log("cag visit Patient data :",visitData);
                                
                                $scope.cagVisitUuid = visitData.activeCagVisits[0].uuid;
                                
                                $scope.cagUuid = visitData.activeCagVisits[0].cag.uuid;                                     
                                $scope.attenderUuid = visitData.activeCagVisits[0].attender.uuid;

                                var patientVisits = visitData.activeCagVisits[0].visits;
                                var count = 1;
                                patientVisits.forEach(function(res){  
                                    console.log("Visit data : ",res);
                                    
                                    $scope.patientUuids = res.patient.uuid;
                                    $scope.patientVisitUuid = res.uuid;
                                    $scope.cagVisitLocation = res.location.uuid; 

                                    //console.log("patient uuid = ",res.patient.uuid);
                                    $scope.complete = false
                                    // Fetch individual regimen from observation end point
                                        $q.all([$scope.fetchPrevRegimen($scope.patientUuids,$scope.patientVisitUuid)]).then(function(response){
                                            if(patientVisits.length == count){
                                                $scope.complete = true;
                                            }
                                            console.log($scope.patientVisitData[count-1]);
                                            // if($patientVisitData)
                                            count++;
                                        });

                                        
                                                                                                                                    
                                });  
                                
                                
                                $q.all([$scope.fetchPrevObsData($scope.patient.uuid)]).then(function (res){  
                                    console.log(res[0].data);
                                    // $scope.cagEncounterDateTime = DateUtil.getDateTimeInSpecifiedFormat(DateUtil.now(),"YYYY-MM-DDThh:mm:ss.ss+HHMM");
                                    // $scope.obsDateTime = DateUtil.getDateTimeInSpecifiedFormat(DateUtil.now(),"YYYY-MM-DDThh:mm:ss.ss+HHMM")

                                    $scope.cagEncounterDateTime = DateUtil.getDateTimeInSpecifiedFormat(DateUtil.now(),"YYYY-MM-DD hh:mm:ss");
                                    $scope.obsDateTime = DateUtil.getDateTimeInSpecifiedFormat(DateUtil.now(),"YYYY-MM-DD hh:mm:ss")
                                    
                                    var data = res[0].data;  

                                    $q.all([preSavePromise(), encounterService.getEncounterType($state.params.programUuid, sessionService.getLoginLocationUuid())]).then(function (res2){
                                        
                                        console.log(preSavePromise());
                                        // 746818ac-65a0-4d74-9609-ddb2c330a31b
                                        if(res2[0]){
                                            if(res2[0].observations.length==1 && res2[0].observations[0].concept.uuid=="746818ac-65a0-4d74-9609-ddb2c330a31b"){
                                                $scope.provider = $rootScope.currentProvider.uuid;                                               
                                                for(var i = 0; i < res2[0].observations[0].groupMembers.length; i++){
                                                    console.log(res2[0]);
                                                    if(res2[0].observations[0].groupMembers[i].concept.uuid=="65aa58be-3957-4c82-ad63-422637c8dd18"){
                                                        var formData = res2[0].observations[0].groupMembers[i];
                                                        for(var j = 0; j < formData.groupMembers.length; j++){

                                                            //Type of client
                                                            if(formData.groupMembers[j].concept.uuid=="e0bc761d-ac3b-4033-92c7-476304b9c5e8"){
                                                                $scope.TypeOfClientTreatmentValue = formData.groupMembers[j].value.displayString; 
                                                                $scope.TypeOfClientTreatmentUuid = formData.groupMembers[j].value.uuid;
                                                                console.log(formData.groupMembers[j].concept.uuid);
                                                            }
                                                            //Appointment scheduled
                                                            else  if(formData.groupMembers[j].concept.uuid == "ed064424-0331-47f6-9532-77156f40a014"){
                                                                $scope.AppointmentScheduledValue = formData.groupMembers[j].value.displayString;
                                                                $scope.AppointmentScheduledUuid = formData.groupMembers[j].value.uuid; 
                                                            } 
                                                            //Follow-up date
                                                            else if(formData.groupMembers[j].concept.uuid == "88489023-783b-4021-b7a9-05ca9877bf67"){
                                                                $scope.nextCagEncounterDateValue = formData.groupMembers[j].value;
                                                                $scope.nextCagEncounterDateUuid = formData.groupMembers[j].concept.uuid;
                                                            }
                                                            //drug supply duration
                                                            else if(formData.groupMembers[j].concept.uuid == "9eb00622-1078-4f7b-aa69-61e6c36db347"){
                                                                $scope.ARVDrugsSupplyDurationValue = formData.groupMembers[j].value.names[1].name; 
                                                                $scope.ARVDrugsSupplyDurationUuid = formData.groupMembers[j].value.uuid; 
                                                                $scope.ARVDrugsSupplyDurationName = formData.groupMembers[j].value.displayString;
                                                            
                                                            }
                                                            //Drugs days dispensed
                                                            else if(formData.groupMembers[j].concept.uuid == "27d55083-5e66-4b5a-91d3-2c9a42cc9996"){
                                                                $scope.DrugsDaysDispensedValue = formData.groupMembers[j].value;
                                                                $scope.DrugsDaysDispensedUuid = formData.groupMembers[j].concept.uuid; 
                                                            
                                                            }
                                                            //WHO Staging
                                                            else if(formData.groupMembers[j].concept.uuid == "95e1fc28-84ab-4971-8bb1-d8ee68ef5739"){
                                                                $scope.HIVCareWHOStagingValue = formData.groupMembers[j].value.displayString;
                                                                $scope.HIVCareWHOStagingUuid = formData.groupMembers[j].value.uuid;
                    
                                                            }
                                                            //Cotrimoxazole adherence
                                                            else if(formData.groupMembers[j].concept.uuid == "e8d05f4a-9c3f-4f99-941c-596f238f095f"){
                                                                $scope.CotrimoxazoleAdherenceValue = formData.groupMembers[j].value.displayString;
                                                                $scope.CotrimoxazoleAdherenceUuid = formData.groupMembers[j].value.uuid;                                                                    
                                                            }
                                                            //Cotrimoxazole days dispensed
                                                            else if(formData.groupMembers[j].concept.uuid == "3485a002-f72f-43fd-8ba7-0288273489da"){
                                                                $scope.cotrimoxazoleNoOfDaysValue = formData.groupMembers[j].value;
                                                                $scope.cotrimoxazoleNoOfDaysUuid  = formData.groupMembers[j].concept.uuid;  
                                                            }
                                                        }
                                                    }
                                                }
                                                console.log("cagUuid :",$scope.cagUuid);
                                                console.log("cagVisitUuid :",$scope.cagVisitUuid);
                                                console.log("cagEncounterDateTime :",$scope.cagEncounterDateTime);
                                                console.log("obsDateTime :",$scope.obsDateTime);
                                                console.log("nextCagEncounterDateValue :",$scope.nextCagEncounterDateValue);
                                                console.log("nextCagEncounterDateUuid :",$scope.nextCagEncounterDateUuid);
                                                console.log("locationUuid :",$scope.cagVisitLocation);  
                                                console.log("attenderUuid :",$scope.attenderUuid);
                                                console.log("TypeOfClientTreatmentValue :",$scope.TypeOfClientTreatmentValue);
                                                console.log("TypeOfClientTreatmentUuid : ",$scope.TypeOfClientTreatmentUuid);
                                                console.log("AppointmentScheduledValue :",$scope.AppointmentScheduledValue);
                                                console.log("AppointmentScheduledUuid :",$scope.AppointmentScheduledUuid);
                                                console.log("ARVDrugsSupplyDurationValue :",$scope.ARVDrugsSupplyDurationValue);
                                                console.log("ARVDrugsSupplyDurationUuid :",$scope.ARVDrugsSupplyDurationUuid);
                                                console.log("ARVDrugsSupplyDurationName :",$scope.ARVDrugsSupplyDurationName);
                                                console.log("DrugsDaysDispensedValue :",$scope.DrugsDaysDispensedValue);
                                                console.log("DrugsDaysDispensedUuid :",$scope.DrugsDaysDispensedUuid);
                                                console.log("HIVCareWHOStagingValue :",$scope.HIVCareWHOStagingValue);
                                                console.log("HIVCareWHOStagingUuid :",$scope.HIVCareWHOStagingUuid);
                                                console.log("CotrimoxazoleAdherenceValue :",$scope.CotrimoxazoleAdherenceValue);
                                                console.log("CotrimoxazoleAdherenceUuid :",$scope.CotrimoxazoleAdherenceUuid);
                                                console.log("cotrimoxazoleNoOfDaysValue :",$scope.cotrimoxazoleNoOfDaysValue);
                                                console.log("cotrimoxazoleNoOfDaysUuid :",$scope.cotrimoxazoleNoOfDaysUuid);
                                                console.log("provider :",$scope.provider);
                                                console.log("patientVisitData :",$scope.patientVisitData); 


                                                // The function to return POST reponse
                                                var postCagEncounter = createCagEncounter(
                                                    $scope.cagUuid
                                                    ,$scope.cagVisitUuid
                                                    ,$scope.cagEncounterDateTime
                                                    ,$scope.obsDateTime
                                                    ,$scope.nextCagEncounterDateValue
                                                    ,$scope.nextCagEncounterDateUuid
                                                    ,$scope.cagVisitLocation
                                                    ,$scope.attenderUuid
                                                    ,$scope.TypeOfClientTreatmentValue
                                                    ,$scope.TypeOfClientTreatmentUuid
                                                    ,$scope.AppointmentScheduledValue
                                                    ,$scope.AppointmentScheduledUuid
                                                    ,$scope.ARVDrugsSupplyDurationValue
                                                    ,$scope.ARVDrugsSupplyDurationUuid
                                                    ,$scope.ARVDrugsSupplyDurationName
                                                    ,$scope.DrugsDaysDispensedValue
                                                    ,$scope.DrugsDaysDispensedUuid
                                                    ,$scope.HIVCareWHOStagingValue
                                                    ,$scope.HIVCareWHOStagingUuid
                                                    ,$scope.CotrimoxazoleAdherenceValue
                                                    ,$scope.CotrimoxazoleAdherenceUuid
                                                    ,$scope.cotrimoxazoleNoOfDaysValue
                                                    ,$scope.cotrimoxazoleNoOfDaysUuid
                                                    ,$scope.provider
                                                    ,$scope.patientVisitData
                                                );
                                                
                                                // Post cagEncounter
                                                postCagEncounter.then(function(cagEncounter){
                                                    if(cagEncounter.status == 201){
                                                        console.info("CAG Encounter successully posted!!!!",cagEncounter);
                                                        for (let index = 0; index < $scope.patientVisitData.length; index++) {
                                                            console.log($scope.patientVisitData);
                                                            var appointment = {
                                                                "uuid" : null,
                                                                "patientUuid": $scope.patientVisitData[index].patientUuid,
                                                                "serviceUuid": "0c8dfd62-776a-4ddd-bcee-f2570c0721fa",
                                                                "serviceTypeUuid": "257dcd02-e539-46fb-b61c-b23e413935c2",
                                                                "providerUuid":$rootScope.currentProvider.uuid,
                                                                "startDateTime": $scope.nextCagEncounterDateValue,
                                                                "endDateTime": $scope.nextCagEncounterDateValue,
                                                                "locationUuid": "0d4cb392-b10f-473e-8dde-784cd3996cbb",
                                                                "appointmentKind": "Scheduled"
                                                            }
                                                            appService.createAppointment(appointment).then(function(reply){
                                                                console.log(reply);
                                                            });
                                                        }
                                                        
                                                        for(let p = 0; p < cagEncounter.data.encounters.length; p++){
                                                            encounterService.findByEncounterUuid(cagEncounter.data.encounters[p].uuid).then(function(cagEncouterData){
                                                                if(cagEncouterData.data.patientUuid==$scope.attenderUuid){
                                                                    var params = angular.copy($state.params);
                                                                    params.cachebuster = Math.random();

                                                                    return encounterService.findByEncounterUuid(cagEncounter.data.encounters[p].uuid).then(function (saveResponse) {
                                                                        var messageParams = { encounterUuid: saveResponse.data.encounterUuid, encounterType: saveResponse.data.encounterType };
                                                                        auditLogService.log($scope.patient.uuid, "EDIT_ENCOUNTER", messageParams, "MODULE_LABEL_CLINICAL_KEY");
                                                                        var consultationMapper = new Bahmni.ConsultationMapper(configurations.dosageFrequencyConfig(), configurations.dosageInstructionConfig(),
                                                                            configurations.consultationNoteConcept(), configurations.labOrderNotesConcept(), $scope.followUpConditionConcept);
                                                                        var consultation = consultationMapper.map(saveResponse.data);
                                                                        consultation.lastvisited = $scope.lastvisited;
                                                                        return consultation;
                                                                    }).then(function (savedConsultation) {
                                                                        return spinner.forPromise(diagnosisService.populateDiagnosisInformation($scope.patient.uuid, savedConsultation)
                                                                            .then(function (consultationWithDiagnosis) {
                                                                                return saveConditions().then(function (savedConditions) {
                                                                                    consultationWithDiagnosis.conditions = savedConditions;
                                                                                    messagingService.showMessage('info', "{{'CLINICAL_SAVE_SUCCESS_MESSAGE_KEY' | translate}}");
                                                                                }, function () {
                                                                                    consultationWithDiagnosis.conditions = $scope.consultation.conditions;
                                                                                }).then(function () {
                                                                                    copyConsultationToScope(consultationWithDiagnosis);
                                                                                    console.log(copyConsultationToScope(consultationWithDiagnosis));
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
                                                                    }).catch(function (error) {
                                                                        var message = Bahmni.Clinical.Error.translate(error) || "{{'CLINICAL_SAVE_FAILURE_MESSAGE_KEY' | translate}}";
                                                                        messagingService.showMessage('error', message);
                                                                    });;
                                                                }
                                                            
                                                            })
                                                        }
                                                        // var params = angular.copy($state.params);
                                                        // params.cachebuster = Math.random();
                                                        // messagingService.showMessage('info',"Saved CAG Consultation Successully");
                                                        // return $state.transitionTo(toStateConfig ? toStateConfig.toState : $state.current, toStateConfig ? toStateConfig.toParams : params, {
                                                        //     inherit: true,
                                                        //     notify: true,
                                                        //     reload: true
                                                        // });
                                                    }
                                                }).catch(
                                                    function(err){
                                                        
                                                        messagingService.showMessage('error',err.data.error.message);
                                                    }
                                                );
                                            }
                                            else{
                                                alert("can only save HIV Care and Treatment - Followup form");
                                            }
                                        }
                                    }).catch(function(error){
                                        console.log(error);
                                    }); 
                                    
                                    // _.each(data,function(response) {
                                        
                                    //     $scope.provider = response.providers[0].uuid; 
                                        
                                    //     if(response.conceptNameToDisplay == "Follow-up date"){
                                    //         $scope.nextCagEncounterDateValue = response.valueAsString;
                                    //         $scope.nextCagEncounterDateUuid = response.uuid;  
                                            
                                    //     }
                                    //     else if(response.conceptNameToDisplay == "Type of client"){                                                                
                                    //         $scope.TypeOfClientTreatmentValue = response.valueAsString; 
                                    //         $scope.TypeOfClientTreatmentUuid = response.value.uuid;
                                    //     }

                                    //     else  if(response.conceptNameToDisplay == "Appointment scheduled"){
                                    //         $scope.AppointmentScheduledValue = response.valueAsString;
                                    //         $scope.AppointmentScheduledUuid = response.value.uuid; 
                                    //     }                                                                
                                    //     else if(response.conceptNameToDisplay == "ARV drugs supply duration"){
                                    //         $scope.ARVDrugsSupplyDurationValue = response.valueAsString;
                                    //         $scope.ARVDrugsSupplyDurationUuid = response.value.uuid;
                                    //         $scope.ARVDrugsSupplyDurationName = response.value.name;
                                        
                                    //     }
                                    //     else if(response.conceptNameToDisplay == "Drugs days dispensed"){
                                    //         $scope.DrugsDaysDispensedValue = response.valueAsString;
                                    //         $scope.DrugsDaysDispensedUuid = response.uuid; 
                                        
                                    //     }
                                    //     else if(response.conceptNameToDisplay == "WHO Staging"){
                                    //         $scope.HIVCareWHOStagingValue = response.valueAsString;
                                    //         $scope.HIVCareWHOStagingUuid = response.value.uuid;

                                    //     }
                                    //     else if(response.conceptNameToDisplay == "Cotrimoxazole adherence"){
                                    //         $scope.CotrimoxazoleAdherenceValue = response.valueAsString;
                                    //         $scope.CotrimoxazoleAdherenceUuid = response.value.uuid;                                                                    
                                    //     }
                                        
                                    //     else if(response.conceptNameToDisplay == "Cotrimoxazole days dispensed"){
                                    //         $scope.cotrimoxazoleNoOfDaysValue = response.valueAsString;
                                    //         $scope.cotrimoxazoleNoOfDaysUuid  = response.uuid;  
                                    //     } 
                                        

                                    // }); 

                                    // console.log("cagUuid :",$scope.cagUuid);
                                    // console.log("cagVisitUuid :",$scope.cagVisitUuid);
                                    // console.log("cagEncounterDateTime :",$scope.cagEncounterDateTime);
                                    // console.log("obsDateTime :",$scope.obsDateTime);
                                    // console.log("nextCagEncounterDateValue :",$scope.nextCagEncounterDateValue);
                                    // console.log("nextCagEncounterDateUuid :",$scope.nextCagEncounterDateUuid);
                                    // console.log("locationUuid :",$scope.cagVisitLocation);  
                                    // console.log("attenderUuid :",$scope.attenderUuid);
                                    // console.log("TypeOfClientTreatmentValue :",$scope.TypeOfClientTreatmentValue);
                                    // console.log("TypeOfClientTreatmentUuid : ",$scope.TypeOfClientTreatmentUuid);
                                    // console.log("AppointmentScheduledValue :",$scope.AppointmentScheduledValue);
                                    // console.log("AppointmentScheduledUuid :",$scope.AppointmentScheduledUuid);
                                    // console.log("ARVDrugsSupplyDurationValue :",$scope.ARVDrugsSupplyDurationValue);
                                    // console.log("ARVDrugsSupplyDurationUuid :",$scope.ARVDrugsSupplyDurationUuid);
                                    // console.log("ARVDrugsSupplyDurationName :",$scope.ARVDrugsSupplyDurationName);
                                    // console.log("DrugsDaysDispensedValue :",$scope.DrugsDaysDispensedValue);
                                    // console.log("DrugsDaysDispensedUuid :",$scope.DrugsDaysDispensedUuid);
                                    // console.log("HIVCareWHOStagingValue :",$scope.HIVCareWHOStagingValue);
                                    // console.log("HIVCareWHOStagingUuid :",$scope.HIVCareWHOStagingUuid);
                                    // console.log("CotrimoxazoleAdherenceValue :",$scope.CotrimoxazoleAdherenceValue);
                                    // console.log("CotrimoxazoleAdherenceUuid :",$scope.CotrimoxazoleAdherenceUuid);
                                    // console.log("cotrimoxazoleNoOfDaysValue :",$scope.cotrimoxazoleNoOfDaysValue);
                                    // console.log("cotrimoxazoleNoOfDaysUuid :",$scope.cotrimoxazoleNoOfDaysUuid);
                                    // console.log("provider :",$scope.provider);
                                    // console.log("patientVisitData :",$scope.patientVisitData); 
                                    
                                    // // The function to return POST reponse
                                    // var postCagEncounter = createCagEncounter(
                                    //     $scope.cagUuid
                                    //     ,$scope.cagVisitUuid
                                    //     ,$scope.cagEncounterDateTime
                                    //     ,$scope.obsDateTime
                                    //     ,$scope.nextCagEncounterDateValue
                                    //     ,$scope.nextCagEncounterDateUuid
                                    //     ,$scope.cagVisitLocation
                                    //     ,$scope.attenderUuid
                                    //     ,$scope.TypeOfClientTreatmentValue
                                    //     ,$scope.TypeOfClientTreatmentUuid
                                    //     ,$scope.AppointmentScheduledValue
                                    //     ,$scope.AppointmentScheduledUuid
                                    //     ,$scope.ARVDrugsSupplyDurationValue
                                    //     ,$scope.ARVDrugsSupplyDurationUuid
                                    //     ,$scope.ARVDrugsSupplyDurationName
                                    //     ,$scope.DrugsDaysDispensedValue
                                    //     ,$scope.DrugsDaysDispensedUuid
                                    //     ,$scope.HIVCareWHOStagingValue
                                    //     ,$scope.HIVCareWHOStagingUuid
                                    //     ,$scope.CotrimoxazoleAdherenceValue
                                    //     ,$scope.CotrimoxazoleAdherenceUuid
                                    //     ,$scope.cotrimoxazoleNoOfDaysValue
                                    //     ,$scope.cotrimoxazoleNoOfDaysUuid
                                    //     ,$scope.provider
                                    //     ,$scope.patientVisitData
                                    // );
                                    
                                    // // Post cagEncounter
                                    // postCagEncounter.then(function(cagEncounter){
                                    // if(cagEncounter.status == 201){
                                    //         console.info("CAG Encounter successully posted!!!!",cagEncounter)
                                    //         var appointment = {
                                    //             "patientUuid": "c923ca95-d7b6-4b4f-90a2-11c863d0dce6",
                                    //             "serviceUuid": "0c8dfd62-776a-4ddd-bcee-f2570c0721fa",
                                    //             "serviceTypeUuid": "257dcd02-e539-46fb-b61c-b23e413935c2",
                                    //             "startDateTime": "2024-10-28T22:00:00.000Z",
                                    //             "endDateTime": "2024-10-28T22:15:00.000Z",
                                    //             "locationUuid": "0d4cb392-b10f-473e-8dde-784cd3996cbb",
                                    //             "appointmentKind": "Scheduled"
                                    //         }
                                    //     }
                                    // }).catch(
                                    //     function(err){
                                            
                                    //         messagingService.showMessage('error',err.data.error.message);
                                    //     }
                                    // );
                                }).catch(function(error){console.log(error)}); 
                            }else{
                                console.log("Patient is not in any cag");
                            }
                        }
                        ).catch(function(error){
                            console.error("CAG ERROR::No Cag Visit started for attender ",error);
                        });
                    }
                    else{
                        return spinner.forPromise($q.all([preSavePromise(), encounterService.getEncounterType($state.params.programUuid, sessionService.getLoginLocationUuid())])
                        .then(function (results) {
                            var encounterData = results[0];
                            encounterData.encounterTypeUuid = results[1].uuid;
                            var params = angular.copy($state.params);
                            params.cachebuster = Math.random();

                            return encounterService.create(encounterData)
                                .then(function (saveResponse) {
                                    console.log(saveResponse,encounterService.findByEncounterUuid(saveResponse.data.encounterUuid));
                                    var messageParams = { encounterUuid: saveResponse.data.encounterUuid, encounterType: saveResponse.data.encounterType };
                                    auditLogService.log($scope.patient.uuid, "EDIT_ENCOUNTER", messageParams, "MODULE_LABEL_CLINICAL_KEY");
                                    var consultationMapper = new Bahmni.ConsultationMapper(configurations.dosageFrequencyConfig(), configurations.dosageInstructionConfig(),
                                        configurations.consultationNoteConcept(), configurations.labOrderNotesConcept(), $scope.followUpConditionConcept);
                                    var consultation = consultationMapper.map(saveResponse.data);
                                    consultation.lastvisited = $scope.lastvisited;
                                    return consultation;
                                }).then(function (savedConsultation) {
                                    return spinner.forPromise(diagnosisService.populateDiagnosisInformation($scope.patient.uuid, savedConsultation)
                                        .then(function (consultationWithDiagnosis) {
                                            return saveConditions().then(function (savedConditions) {
                                                consultationWithDiagnosis.conditions = savedConditions;
                                                messagingService.showMessage('info', "{{'CLINICAL_SAVE_SUCCESS_MESSAGE_KEY' | translate}}");
                                            }, function () {
                                                consultationWithDiagnosis.conditions = $scope.consultation.conditions;
                                            }).then(function () {
                                                copyConsultationToScope(consultationWithDiagnosis);
                                                console.log(copyConsultationToScope(consultationWithDiagnosis));
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
                                }).catch(function (error) {
                                    var message = Bahmni.Clinical.Error.translate(error) || "{{'CLINICAL_SAVE_FAILURE_MESSAGE_KEY' | translate}}";
                                    messagingService.showMessage('error', message);
                                });
                            }
                        ));
                    }
                })
                
            };
            var removeAttenderInOtherCagMember = function(patientVisitArray, patientToRemove) { 
    
                return patientVisitArray.filter(function(ele){ 
                    return ele != patientToRemove; 
                });
            }
            
            var createCagEncounter = function(
                 cagUuid
                ,cagVisitUuid
                ,cagEncounterDateTime
                ,obsDateTime
                ,nextCagEncounterDateValue
                ,nextCagEncounterDateUuid
                ,cagVisitLocation
                ,attenderUuid
                ,TypeOfClientTreatmentUuid
                ,TypeOfClientTreatmentValue
                ,AppointmentScheduledUuid
                ,AppointmentScheduledValue
                ,ARVDrugsSupplyDurationValue
                ,ARVDrugsSupplyDurationUuid
                ,ARVDrugsSupplyDurationName
                ,DrugsDaysDispensedValue
                ,DrugsDaysDispensedUuid
                ,HIVCareWHOStagingValue
                ,HIVCareWHOStagingUuid
                ,CotrimoxazoleAdherenceValue
                ,CotrimoxazoleAdherenceUuid
                ,cotrimoxazoleNoOfDaysValue
                ,cotrimoxazoleNoOfDaysUuid
                ,provider
                ,patientVisitData
            ){
                var orderAsDirected = {
                    "instructions":"As directed"
                };
                var orderToString = JSON.stringify(orderAsDirected);
                console.log("Order", orderToString);
                var cagEncounterData = [];
                
                    console.log("data id : ",cagEncounterData);
                    
                    var autoExpireDate = Bahmni.Common.Util.DateUtil.addDays(cagEncounterDateTime,3);
                    
                    autoExpireDate = moment(autoExpireDate, "YYYY-MM-DDTHH:mm:ss.SSSZZ").format();
                
                    console.log("expiry date : ",autoExpireDate);

                    var attenderEncounterData = [];
                    
                    for (let index = 0; index < patientVisitData.length; index++) {
                        if (patientVisitData[index].patientUuid ==  attenderUuid) {
                             
                            var attenderData = {
                                "encounterDatetime":  cagEncounterDateTime,
                                "encounterType":{
                                    "uuid": "81852aee-3f10-11e4-adec-0800271c1b75"
                                },
                                "patient": {
                                    "uuid": attenderUuid
                                },
                                "visit": {
                                     "uuid": patientVisitData[index].patientVisitUuid
                                },
                                "location":{
                                    "uuid": cagVisitLocation 
                                },
                                "orders":[
                                    {
                                        "type": "drugorder",
                                        "patient": patientVisitData[index].patientUuid ,
                                        "orderType": "131168f4-15f5-102d-96e4-000c29c2a5d7",
                                        "concept":  "9d155660-c16e-42d8-bff1-76cebe867e56",
                                        "dateActivated" : cagEncounterDateTime,
                                        "autoExpireDate" : autoExpireDate,
                                        "orderer" : provider, // should get the current logged Provider
                                        "urgency": "ON_SCHEDULED_DATE",
                                        "careSetting": "6f0c9a92-6f24-11e3-af88-005056821db0",
                                        "scheduledDate":  cagEncounterDateTime,
                                        "dose": 1,
                                        "doseUnits": "86239663-7b04-4563-b877-d7efc4fe6c46",
                                        "frequency": "9d7c32a2-3f10-11e4-adec-0800271c1b75",
                                        "quantity":  DrugsDaysDispensedValue,
                                        "quantityUnits": "86239663-7b04-4563-b877-d7efc4fe6c46",
                                         "drug": "189a5fc2-d29b-4ce5-b3ca-dc5405228bfc",
                                        "numRefills": 0,
                                        "dosingInstructions": "{\"instructions\":\"As directed\"}",
                                        "duration":  DrugsDaysDispensedValue,
                                        "durationUnits": "9d7437a9-3f10-11e4-adec-0800271c1b75",
                                        "route": "9d6bc13f-3f10-11e4-adec-0800271c1b75",
                                        "action": "NEW"
                                    }
                                ],
                                "obs":[
                                    {
                                        "concept": {
                                            "conceptId": 2403,
                                            "uuid": "746818ac-65a0-4d74-9609-ddb2c330a31b" 
                                        },
                                        "obsDatetime": obsDateTime,
                                        "person": attenderUuid,
                                        "location":  cagVisitLocation,
                                        "groupMembers": [
                                            {
                                                "concept": {
                                                    "conceptId": 3753,
                                                    "uuid": "65aa58be-3957-4c82-ad63-422637c8dd18"
                                                },
                                                "obsDatetime": obsDateTime,
                                                "person": {
                                                    "uuid": attenderUuid
                                                },
                                                "location":{
                                                    "uuid": cagVisitLocation
                                                },
                                                "groupMembers": [
                                                    {
                                                        "concept": {
                                                            "conceptId": 3843,
                                                            "uuid": "e0bc761d-ac3b-4033-92c7-476304b9c5e8"
                                                        },
                                                        "valueCoded": TypeOfClientTreatmentUuid,
                                                        "valueCodedName": TypeOfClientTreatmentValue,
                                                        "valueText":TypeOfClientTreatmentValue,
                                                        "obsDatetime": obsDateTime,
                                                        "person": {
                                                            "uuid": attenderUuid
                                                        },
                                                        "location":{
                                                            "uuid": cagVisitLocation
                                                        } 
                                                    },
                                                    {
                                                        "concept": {
                                                            "conceptId": 3751,
                                                            "uuid": "ed064424-0331-47f6-9532-77156f40a014"
                                                        },
                                                        "valueCoded": AppointmentScheduledValue,
                                                        "valueCodedName": AppointmentScheduledValue,
                                                        "valueText": AppointmentScheduledValue,
                                                        "obsDatetime": obsDateTime,
                                                        "person": {
                                                            "uuid": attenderUuid
                                                        }
                                                    },
                                                    {
                                                        "concept": {
                                                            "conceptId": 3752,
                                                            "uuid": "88489023-783b-4021-b7a9-05ca9877bf67"
                                                        },
                                                        "valueDatetime": nextCagEncounterDateValue,
                                                        "obsDatetime": obsDateTime,
                                                        "person": {
                                                            "uuid": attenderUuid
                                                        }
                                                    },
                                                    {
                                                        "concept": {
                                                            "conceptId": 2250,
                                                            "uuid": "13382e01-9f18-488b-b2d2-58ab54c82d82"
                                                        },
                                                        "valueCoded": patientVisitData[index].patientRegimenUuid,
                                                        "valueCodedName": patientVisitData[index].patientRegimen,
                                                        "valueDrug": patientVisitData[index].patientRegimen,
                                                        "obsDatetime":  obsDateTime,
                                                        "person": {
                                                            "uuid": attenderUuid
                                                        }
                                                    },
                                                    {
                                                        "concept": {
                                                            "conceptId": 4174,
                                                            "uuid": "9eb00622-1078-4f7b-aa69-61e6c36db347"
                                                        },
                                                        "valueCoded":  ARVDrugsSupplyDurationUuid,
                                                        "valueCodedName":  ARVDrugsSupplyDurationName,
                                                        "valueText":  ARVDrugsSupplyDurationValue,
                                                        "obsDatetime": obsDateTime,
                                                        "person": {
                                                            "uuid": attenderUuid
                                                        }
                                                    },
                                                    {
                                                        "concept": {
                                                            "conceptId": 3730,
                                                            "uuid": "27d55083-5e66-4b5a-91d3-2c9a42cc9996"
                                                        },
                                                        "valueNumeric":  DrugsDaysDispensedValue,
                                                        "obsDatetime":  obsDateTime,
                                                        "person": {
                                                            "uuid":  attenderUuid
                                                        }
                                                    },
                                                    {
                                                        "concept": {
                                                            "conceptId": 2224,
                                                            "uuid": "95e1fc28-84ab-4971-8bb1-d8ee68ef5739"
                                                        },
                                                        "valueCoded": HIVCareWHOStagingUuid,
                                                        "valueCodedName": HIVCareWHOStagingValue,
                                                        "valueText":HIVCareWHOStagingValue,
                                                        "obsDatetime": obsDateTime,
                                                        "person": {
                                                            "uuid": attenderUuid
                                                        }
                                                    },
                                                    {
                                                        "concept": {
                                                            "conceptId": 3726,
                                                            "uuid": "e8d05f4a-9c3f-4f99-941c-596f238f095f"
                                                        },
                                                        "valueCoded": CotrimoxazoleAdherenceUuid,
                                                        "valueCodedName": CotrimoxazoleAdherenceValue,
                                                        "valueText": CotrimoxazoleAdherenceValue,
                                                        "obsDatetime": obsDateTime,
                                                        "person": {
                                                            "uuid": attenderUuid
                                                        }
                                                    },
                                                    {
                                                        "concept": {
                                                            "conceptId": 3728,
                                                            "uuid": "3485a002-f72f-43fd-8ba7-0288273489da"
                                                        },
                                                        "valueNumeric":cotrimoxazoleNoOfDaysValue,
                                                        "obsDatetime": obsDateTime,
                                                        "person": {
                                                            "uuid": attenderUuid
                                                        }
                                                    }
                                                ]
                                            }
                                        ]
                                    }            
                                ]
                            };
                            cagEncounterData.push(attenderData)
                            console.log("attenderEncounterData : ",attenderEncounterData);
                        }else if(patientVisitData[index].patientUuid != attenderUuid){
                            // Exclude the attender from the list of cagVisits
                            //removeAttenderInOtherCagMember();
                            var otherCagMemberData =     {
                                "encounterDatetime": cagEncounterDateTime,
                                "encounterType":{
                                    "uuid": "81852aee-3f10-11e4-adec-0800271c1b75"
                                },
                                "patient": {
                                    "uuid": patientVisitData[index].patientUuid
                                },
                                "visit": {
                                    "uuid":  patientVisitData[index].patientVisitUuid
                                },
                                "location":{
                                    "uuid": cagVisitLocation
                                },
                                "orders":[
                                    {
                                        "type": "drugorder",
                                        "patient":  patientVisitData[index].patientUuid,
                                        "orderType": "131168f4-15f5-102d-96e4-000c29c2a5d7",
                                        "concept": "9d155660-c16e-42d8-bff1-76cebe867e56",
                                        "dateActivated" : cagEncounterDateTime,
                                        "autoExpireDate" : autoExpireDate,
                                        "orderer" : provider,
                                        "urgency": "ON_SCHEDULED_DATE",
                                        "careSetting": "6f0c9a92-6f24-11e3-af88-005056821db0",
                                        "scheduledDate": cagEncounterDateTime,
                                        "dose": 1,
                                        "doseUnits": "86239663-7b04-4563-b877-d7efc4fe6c46",
                                        "frequency": "9d7c32a2-3f10-11e4-adec-0800271c1b75",
                                        "quantity": 30.0,
                                        "quantityUnits": "86239663-7b04-4563-b877-d7efc4fe6c46",
                                        "drug": "189a5fc2-d29b-4ce5-b3ca-dc5405228bfc",
                                        "numRefills": 0,
                                        "dosingInstructions": "{\"instructions\":\"As directed\"}",
                                        "duration": 30,
                                        "durationUnits": "9d7437a9-3f10-11e4-adec-0800271c1b75",
                                        "route": "9d6bc13f-3f10-11e4-adec-0800271c1b75",
                                        "action": "NEW"
                                    }
                                ],
                                "obs":[
                                    {
                                        "concept": {
                                            "conceptId": 2403,
                                            "uuid": "746818ac-65a0-4d74-9609-ddb2c330a31b"
                                        },
                                        "obsDatetime": obsDateTime,
                                        "person":  patientVisitData[index].patientUuid,
                                        "location": cagVisitLocation,
                                        "groupMembers": [
                                            {
                                                "concept": {
                                                    "conceptId": 3753,
                                                    "uuid": "65aa58be-3957-4c82-ad63-422637c8dd18"
                                                },
                                                "obsDatetime": obsDateTime,
                                                "person": {
                                                    "uuid":  patientVisitData[index].patientUuid
                                                },
                                                "location":{
                                                    "uuid": cagVisitLocation
                                                },
                                                "groupMembers": [
                                                    {
                                                        "concept": {
                                                            "conceptId": 3843,
                                                            "uuid": "e0bc761d-ac3b-4033-92c7-476304b9c5e8"
                                                        },
                                                        "valueCoded": "0f880c52-3ced-43ac-a79b-07a2740ae428",
                                                        "valueCodedName": "Treatment Buddy",
                                                        "valueText": "Treatment Buddy",
                                                        "obsDatetime": obsDateTime,
                                                        "person": {
                                                            "uuid": patientVisitData[index].patientUuid
                                                        },
                                                        "location":{
                                                            "uuid": cagVisitLocation
                                                        } 
                                                    },
                                                    {
                                                        "concept": {
                                                            "conceptId": 3751,
                                                            "uuid": "ed064424-0331-47f6-9532-77156f40a014"
                                                        },
                                                        "valueCoded": AppointmentScheduledValue,
                                                        "valueCodedName": AppointmentScheduledValue,
                                                        "valueText": AppointmentScheduledValue,
                                                        "obsDatetime": obsDateTime,
                                                        "person": {
                                                            "uuid":  patientVisitData[index].patientUuid
                                                        }
                                                    },
                                                    {
                                                        "concept": {
                                                            "conceptId": 3752,
                                                            "uuid": "88489023-783b-4021-b7a9-05ca9877bf67"
                                                        },
                                                        "valueDatetime": nextCagEncounterDateValue,
                                                        "obsDatetime": obsDateTime,
                                                        "person": {
                                                            "uuid":  patientVisitData[index].patientUuid
                                                        }
                                                    },
                                                    {
                                                        "concept": {
                                                            "conceptId": 2250,
                                                            "uuid": "13382e01-9f18-488b-b2d2-58ab54c82d82"
                                                        },                                                       
                                                        "valueCoded": patientVisitData[index].patientRegimenUuid,
                                                        "valueCodedName": patientVisitData[index].patientRegimen,
                                                        "valueDrug": patientVisitData[index].patientRegimen,
                                                        "obsDatetime": obsDateTime,
                                                        "person": {
                                                            "uuid":  patientVisitData[index].patientUuid
                                                        }
                                                    },
                                                    {
                                                        "concept": {
                                                            "conceptId": 4174,
                                                            "uuid": "9eb00622-1078-4f7b-aa69-61e6c36db347"
                                                        },
                                                        "valueCoded": ARVDrugsSupplyDurationUuid,
                                                        "valueCodedName": ARVDrugsSupplyDurationName,
                                                        "valueText": ARVDrugsSupplyDurationValue,
                                                        "obsDatetime": obsDateTime,
                                                        "person": {
                                                            "uuid": patientVisitData[index].patientUuid
                                                        }
                                                    },
                                                    {
                                                        "concept": {
                                                            "conceptId": 3730,
                                                            "uuid": "27d55083-5e66-4b5a-91d3-2c9a42cc9996"
                                                        },
                                                        "valueNumeric": DrugsDaysDispensedValue,
                                                        "obsDatetime": obsDateTime,
                                                        "person": {
                                                            "uuid": patientVisitData[index].patientUuid
                                                        }
                                                    }
                                                ]
                                            }
                                        ]
                                    }            
                                ]
                            }
                           
                            cagEncounterData.push(otherCagMemberData);
                            
                        }
                        console.log("otherCagMemberData : ",cagEncounterData)
                    } 
                     
                    var encounterData={
                        cag:{
                            uuid: cagUuid
                        },       
                        cagVisit: {
                            uuid: cagVisitUuid
                        },
                        cagEncounterDateTime:  cagEncounterDateTime, 
                        nextEncounterDate: nextCagEncounterDateValue, 
                        location: {
                            uuid:  cagVisitLocation  
                        },
                        attender: {
                            uuid:  attenderUuid  
                        },
                        encounters:cagEncounterData

                    }    
                    console.log(encounterData);    
                    
                    var cagEncounter = appService.createCagEncounter(encounterData);
                    
                    return cagEncounter;
                
            }
            initialize();
        }]);
