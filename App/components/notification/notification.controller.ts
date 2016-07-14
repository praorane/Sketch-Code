//  Copyright (c) Microsoft Corporation. All rights reserved
//  notification.controller.js
//  The implementation of notification ui at the footer area. 

/// <reference path="../../../scripts/typings/angularjs/angular.d.ts" />

namespace SketchSvg {
    'use strict';

    export class NotificationController {
        public notifications: Array<NotificationMessage>;

        static $inject = ['$scope', 'notificationService'];

        constructor(private $scope: angular.IScope, private notificationService: NotificationService) {
            var vm = this;
            $scope.$watchCollection(() => {
                return notificationService.notificationMessages;
            }, (newVal, oldVal) => {
                this.notifications = newVal;
            });
        }

        public dismissNotification(index: number) {
            this.notificationService.dismiss(index);
        }
    }
}