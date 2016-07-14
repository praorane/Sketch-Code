// Copyright (c) Microsoft Corporation. All rights reserved
//  common-types.d.ts
//  The definitions of the common types and their extensions.

interface Array<T> {
    /**
        * Returns the value of the first element in the array where predicate is true, and undefined
        * otherwise.
        * @param predicate find calls predicate once for each element of the array, in ascending
        * order, until it finds one where predicate returns true. If such an element is found, find
        * immediately returns that element value. Otherwise, find returns undefined.
        * @param thisArg If provided, it will be used as the this value for each invocation of
        * predicate. If it is not provided, undefined is used instead.
        */
    find(predicate: (value: T, index: number, obj: Array<T>) => boolean, thisArg?: any): T;
}

interface String {
    format(...replacements: string[]): string;
}

interface Window {
    PointerEvent?: PointerEvent;
}

declare namespace angular.ui {
    interface IState {
        // Adal lib auguments this interface. We need this field for the login option.
        requireADLogin: boolean;
    }
}

declare namespace SketchSvg {
    interface IPoint {
        x: number;
        y: number;
    }

    interface IRect {
        x: number;
        y: number;
        width: number;
        height: number;
    }

    interface ICommand {
        id: string,
        name: string,
        icon: string,
    }

    interface IFilterCommand extends ICommand {
        isChecked: boolean,
    }
}
