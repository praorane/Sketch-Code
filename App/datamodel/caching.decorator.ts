//  Copyright (c) Microsoft Corporation. All rights reserved
//  sharedblade.controller.ts
//  Controller for the shared blade control.

var cache = {};

namespace SketchSvg {
    export function Cache(functionHash) {
        return function (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) {
            let originalMethod = descriptor.value; // save a reference to the original method

            // NOTE: Do not use arrow syntax here. Use a function expression in 
            // order to use the correct value of `this` in this method (see notes below)
            descriptor.value = function (...args: any[]) {
                console.log("The method args are: " + JSON.stringify(args)); // pre
                // console.log(originalMethod.toString());
            
                // create hash based on function name, method implementation, and arguments passed
                var hash = functionHash + originalMethod.toString() + args.toString();
                if (cache[hash] != null) { // Have we run this function before?
                    console.log('using cache')
                    console.log(cache);

                    return cache[hash];
                }
                else {
                    console.log('using request')
                    let result = originalMethod.apply(this, args);               // run and store the result
                    cache[hash] = result;
                
                    // console.log("The return value is: " + result);               // post
                    return result;                                               // return the result of the original method
                }
            };

            return descriptor;
        }
    }
}