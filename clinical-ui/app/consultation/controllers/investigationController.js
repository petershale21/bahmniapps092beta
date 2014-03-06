'use strict';

angular.module('opd.consultation')
.controller('InvestigationController', ['$scope', '$rootScope', 'spinner', 'labTestsProvider', 'otherTestsProvider', function ($scope, $rootScope, spinner, labTestsProvider, otherTestsProvider) {
    var investigations = $rootScope.consultation.investigations;

    $scope.tabs = [
        {name: 'Laboratory', testsProvider: labTestsProvider, filterColumn: "sample", filterHeader: "Sample",categoryColumn: "department"},
        {name: 'Other', testsProvider: otherTestsProvider, filterColumn: "type", filterHeader: "Investigation",categoryColumn: "category"},
    ];

    $scope.activateTab = function(tab){
        $scope.activeTab && ($scope.activeTab.klass="");
        $scope.activeTab = tab;
        $scope.activeTab.klass="active";
    }

    $scope.activateTab($scope.tabs[0]);

    $scope.toggleNote = function() {
        $scope.noteState = $scope.noteState ? false : true;
    }


    var init = function() {
        $scope.noteState =  $scope.consultation.labOrderNote && $scope.consultation.labOrderNote.value ? true : false;
    }

    $scope.onNoteChanged = function() {
        if($scope.consultation.labOrderNote){
            $scope.consultation.labOrderNote.observationDateTime = new Date();
        }
    }

    init();
}]);
