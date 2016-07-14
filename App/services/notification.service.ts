// Copyright (c) Microsoft Corporation. All rights reserved
//  notification.service.ts
//  The implementation of notification message service.

/// <reference path="../../Scripts/typings/angularjs/angular.d.ts" />

module SketchSvg {
    'use strict';

    export enum ENotificationType {
        Error,
        Warning,
        Information
    }

    export class NotificationMessage {
        public header: string;
        public message: string;
        public type: string;

        constructor(_header: string, _message: string, _type: ENotificationType) {
            var vm = this;
            this.header = _header;
            this.message = _message;
            this.type = ENotificationType[_type];
        }
    }

    export class NotificationService {
        public notificationMessages: NotificationMessage[] = new Array();

        constructor() {
        }

        public notify(message: NotificationMessage) {
            this.notificationMessages.push(message);
        }

        public clear() {
            this.notificationMessages = [];
        }

        public dismiss(messageIndex: number) {
            this.notificationMessages.splice(messageIndex, 1);
        }

    }
}