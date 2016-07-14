//  Copyright (c) Microsoft Corporation. All rights reserved
//  notification.directive.js
//  The implementation of notification ui at the footer area. 

/// <reference path="../../../scripts/typings/angularjs/angular.d.ts" />

namespace SketchSvg {
    'use strict';

    export class Notification implements angular.IDirective {
        public restrict = 'AE';
        public replace = true;
        public templateUrl = 'App/components/notification/notification.template.html';
        public controller = 'NotificationController';
        public controllerAs = 'notificationControl';
        public bindToController = true;

        constructor() {   
        }      
    }
}