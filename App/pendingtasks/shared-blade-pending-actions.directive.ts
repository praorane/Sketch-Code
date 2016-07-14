//  Copyright (c) Microsoft Corporation. All rights reserved
//  sharedblade-pendingactions-listview.js
//  The implementation of pending actions listview blade content. 

/// <reference path="../../scripts/typings/angularjs/angular.d.ts" />

namespace SketchSvg {
    'use strict';

    export class PendingActionslist implements angular.IDirective {
        public restrict = 'AE';
        public replace = true;
        public templateUrl = 'App/pendingtasks/shared-blade-pending-actions.listview.html';
        public controller = 'SharedBladePendingActionsController';
        public controllerAs = 'pendingActionsControl';
        public bindToController = true;

        constructor() {
        }
    }
}