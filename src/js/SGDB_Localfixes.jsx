const SGDB = window.require('steamgriddb');
const fs = window.require('fs');
const jsonminify = window.require('jsonminify');

// overwrite methods to fix non-existent id's in SGDB into native SGDB ids
class SGDB_Localfixes extends SGDB {
    constructor(options) {
        super(options);

        // load the local JSON file
        this.loadLocalFixes();
    }

    // file must reside in CWD
    loadLocalFixes() {
        const localFixesFile = "LocalFixes.JSON";
        this.localFixes = {};

        if (fs.existsSync(localFixesFile)) {
            const localFixesStr = fs.readFileSync(localFixesFile).toString();
            this.localFixes = JSON.parse(jsonminify(localFixesStr));
        }
    }

    // overwritten method, fixes id and calls base class
    getGame(options) {
        // API must be called with 'id' for native SGDB ids
        var fixedType = 'id';

        let idsByType = this.fixIds(options.type, options.id, fixedType);
        // if we have found a fixed id, use it
        if (typeof idsByType.types[fixedType] !== "undefined") {
            options.type = fixedType;
            options.id = idsByType.orderedFixedIds[0];
        }
        // call base
        return super.getGame(options);
    }

    // overwritten method, fixes id and calls base class
    getHeroes(options) {
        return this.getPromiseWithFixedOptions("getHeroes", options);
    }

    // overwritten method, fixes id and calls base class
    getGrids(options) {
        return this.getPromiseWithFixedOptions("getGrids", options);
    }

    // overwritten method, fixes id and calls base class
    getLogos(options) {
        return this.getPromiseWithFixedOptions("getLogos", options);
    }

    // general method for functions that take options with multiple ids, fixes ids and (possibly multiply) calls base class for each type
    getPromiseWithFixedOptions(func, options) {
        return new Promise((resolve, reject) => {
            var promises = [];

            // get a list of ids grouped by type, after they have been fixed.
            // here API must be called with 'game' for native SGDB ids  
            let idsByType = this.fixIds(options.type, options.id, 'game');

            // remember original order of id, caller expects the results in this order! we use the fixed id's here because we use them for comparison later on
            // push onto the promises, so we get them in the .all() call
            promises.push(idsByType.orderedFixedIds);

            // make one request per type (API can only query one type per call)
            for (var type in idsByType.types) {
                var ids = idsByType.types[type];
                options.id = ids.join(",");
                options.type = type;

                // push the queried ids to the promise, so we know which result belongs to which id in .all()
                promises.push(ids);
                // select method, can this be done more elegant? pass method?
                switch (func) {
                    case "getHeroes":
                        promises.push(super.getHeroes(options));
                        break;
                    case "getGrids":
                        promises.push(super.getGrids(options));
                        break;
                    case "getLogos":
                        promises.push(super.getLogos(options));
                        break;
                    }
            };

            // here we get all results:
            // [0] HEADER: Array of original query as fixedIds
            // [1] IDs: Array of ids for a given type 
            // [2] IDs: Array of results for a given type
            // [3] next IDs
            // [4] next results
            Promise.all(promises).then((res) => {
                var idOrder = res[0];

                // only one id queried -> just return the result
                if (idOrder.length == 1)
                {
                    let response = res[2];

                    resolve(response);
                }
                else {
                    // create an object remembering results by id
                    let resultsById = {};

                    for (var i = 1; i < res.length; i += 2) {
                        let currentIds = res[i];
                        let response = res[i + 1];

                        // the API returns nested objects when multiple ids are queried
                        // caller expects plain when 1 id is queried and nested if multiple
                        // since we might make multiple single queries out of a multi we need 
                        // to emulate that here
                        currentIds.map((id, num) => {
                            // if API expects nested and we have only one result -> nest it
                            if (currentIds.length == 1) {
                                resultsById[id] = { success: true, data: response };
                            }
                            else
                                resultsById[id] = response[num];
                        });
                    }

                    // we have all the results for every (fixed) id, time to create an array for the result
                    var ret = [];

                    idOrder.map((id) => {
                        ret.push(resultsById[id]);
                    });

                    resolve(ret);
                }
            }).catch((err) => {
                reject(err);
            });
        });
    }

    // check if we have a fix for given type/id combinations and return fixed ids by type
    // we return an object like that
    // obj.orderedFixedIds: Array of fixed(!) ids in original order
    // obj.types: object with property for each type that has an array of fixed ids, i.e. obj.types["egs"]
    fixIds(type, ids, fixedType) {
        var res = {};
        res.types = [];
        res.orderedFixedIds = [];

        ids.split(",").forEach(id => {
            var fixedGame = undefined;
            try { fixedGame = this.localFixes[type][id] } catch {}
            var newId = id;
            var newType = type;

            // did we find a fixed entry?
            if (typeof fixedGame !== 'undefined') {
                newId = fixedGame.id;
                newType = fixedType;
            }

            res.types[newType] = res.types[newType] || [];
            res.types[newType].push(newId);
            res.orderedFixedIds.push(newId);
        });

        return res;
    }
}

export default SGDB_Localfixes;
