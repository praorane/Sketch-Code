//  Copyright (c) Microsoft Corporation. All rights reserved
//  notification.controller.js
//  The implementation of notification ui at the footer area. 

/// <reference path="../../../scripts/typings/angularjs/angular.d.ts" />

namespace SketchSvg {
    'use strict';

    export class FeedbackResult {
        reasonCode: string;
        message: string;
    }

    export class PlanningFeedbackController {
        public message: string;

        public get dcId(): string {
            return this._commonInfo.dcId;
        }

        public get dcName(): string {
            return this._commonInfo.dcName;
        }

        public get coloId(): string {
            return this._commonInfo.coloId;
        }

        public get coloName(): string {
            return this._commonInfo.coloName;
        }

        public get demandId(): string {
            return this._commonInfo.demandId;
        }

        public get groupId(): string {
            return this._commonInfo.groupId;
        }

        public get userAlias(): string {
            return this._commonInfo.userAlias;
        }

        public get issues(): Array<Incident> {
            return this._issues;
        }

        public get isSubmitDisabled(): boolean {
            var vm = this;
            if (vm.selectedReason === this._issues[0].Code.toString()
                || vm.message.length === 0) {
                // No reason is selected or no message is entered.
                // So disable submit button 
                return true;
            }
            return false;
        }

        public selectedReason: string;

        static $inject = ['$scope', '$uibModalInstance', 'commonInfo'];

        private _issues: Array<Incident>;

        constructor(private $scope: angular.IScope, private $uibModalInstance, private _commonInfo: FeedbackCommonInfo) {
            var vm = this;
            this._issues = _commonInfo.incidentReasons.getReasonsByType('Escalate');
            // Insert the "Please select..." prompt to the beginning of the list. 
            this._issues.splice(0, 0, {
                Code: 0,
                IncidentType: '',
                Reason: 'Please select...',
                Scope: '',
                TicketAssignedTo: ''
            });
            vm.selectedReason = this._issues[0].Code.toString();
            vm.message = '';
        }

        public submit() {
            var vm = this;
            this.$uibModalInstance.close({
                reason: vm.selectedReason,
                message: vm.message
            });
        }

        public cancel() {
            this.$uibModalInstance.dismiss('cancel');
        }
    }
}