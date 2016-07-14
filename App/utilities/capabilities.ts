// Copyright (c) Microsoft Corporation. All rights reserved
//  capabilities.ts
//  Implementations of detectuin code of various capabilities
/// <reference path="../../Scripts/typings/angularjs/angular.d.ts" />
/// <reference path="../defs/common-types.d.ts" />

namespace SketchSvg {

    export class Capalities {
        @Cache('hasPointerEventSupport')
        public static hasPointerEventSupport(): boolean {
            return !!window.PointerEvent;
        }
    }
}