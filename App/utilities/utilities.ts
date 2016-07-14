// Copyright (c) Microsoft Corporation. All rights reserved
//  utilities.ts
//  This file contains all the utility functions and objects

namespace SketchSvg {
    'use strict';

    export enum KnownError {
        serviceCallFailure,
        incorrectUsageOfApi
    }

    export class AppError extends Error {
        constructor(private _name: KnownError, private _message: string) {
            super(_message);
        }

        public get ErrorCode(): KnownError {
            return this._name;
        }

        public get message(): string {
            return this._message;
        }
    }

    export class AppCommand {
        public static none: string = '';
        public static coolingFilter: string = 'CoolingFilter';
        public static propertyGroupFilter: string = 'propertyGroupFilter';
        public static reservationsView: string = 'reservationsView';
        public static powerView: string = 'powerView';
        public static selectColo: string = 'selectColo';
        public static selectDataCenter: string = 'selectDataCenter';
        public static enterReservationDetailView: string = 'enterReservationDetailView';
        public static exitReservationDetailView: string = 'exitReservationDetailView';
        public static tileSelectionModeChange: string = 'tileSelectionModeChange';
        public static tileSelectionChanged: string = 'tileSelectionChanged';
        public static feedbackRequest: string = 'feedbackRequest';
        public static reportError: string = 'reportError';
        public static setActiveDemand: string = 'setActiveDemand';
        public static resetActiveDemand: string = 'resetActiveDemand';
        public static addTileAssignment: string = 'addTileAssignment';
        public static removeTileAssignment: string = 'removeTileAssignment';
    }

    export class AppStringResources {
        public static generalError: string = '{0}. Please try reloading.';
    }

    // This helper class releases all registered event handlers when the associated scope is about to be destoryed.
    export class HandlerReleaser {
        private _handlerUnregistrations: Array<() => void> = [];

        constructor(scope: angular.IScope) {
            this._handlerUnregistrations.push(scope.$on('$destroy', () => {
                for (var i = 0; i < this._handlerUnregistrations.length; i++) {
                    // Release all handlers to avoid leaking
                    this._handlerUnregistrations[i]();
                }
                this._handlerUnregistrations.splice(0, this._handlerUnregistrations.length);
           }));
        }

        public register(releaser) {
            this._handlerUnregistrations.push(releaser);
        }
    }

    if (!Array.prototype.find) {
        Array.prototype.find = function (predicate) { // TODO(tmarkvluwer): strongly type this predicate as seen here http://stackoverflow.com/questions/14638990/are-strongly-typed-functions-as-parameters-possible-in-typescript
            if (this === null) {
                throw new TypeError('Array.prototype.find called on null or undefined');
            }

            if (typeof predicate !== 'function') {
                throw new TypeError('predicate must be a function');
            }
            var list = Object(this);
            var length = list.length >>> 0;
            var thisArg = arguments[1];
            var value;

            for (var i = 0; i < length; i++) {
                value = list[i];
                if (predicate.call(thisArg, value, i, list)) {
                    return value;
                }
            }
            return undefined;
        };
    }

    if (!String.prototype.format) {
        String.prototype.format = function () {
            /// <summary> 
            ///     Formats a string in C# style; usage: format("{0} is good {1}", arg1, arg2). It is assumed that 'this'
            ///     string has {} placeholders correspondent to arguments passed to the function.
            /// </summary>
            var args = arguments;
            return this.replace(/{(\d+)}/g, function (match, number) {
                return typeof args[number] != 'undefined'
                    ? args[number]
                    : match
                    ;
            });
        };
    }

    export function normalizeMsfPartNumber(msfPartNumber: number | string): number {
        if (typeof (msfPartNumber) === "string") {
            return parseInt((<string>msfPartNumber).substring(4)); // e.g: MSF-01234 => 1234
        }
        return <number>msfPartNumber;
    }

    export function isNonEmptyString(value: any): boolean {
        if (typeof (value) === 'string' && (<string>value).length !== 0) {
            return true;
        }

        return false;
    }
}