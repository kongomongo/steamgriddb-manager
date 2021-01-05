const SGDB = window.require('steamgriddb');
const fs = window.require('fs');
const jsonminify = window.require('jsonminify');

class SGDB_Localfixes extends SGDB {
    constructor(options) {
        super(options);

        this.LoadLocalFixes();
    }

    LoadLocalFixes() {
        const localFixesFile = "LocalFixes.JSON";
        this.localFixes = {};

        if (fs.existsSync(localFixesFile)) {
            const localFixesStr = fs.readFileSync(localFixesFile).toString();
            this.localFixes = JSON.parse(jsonminify(localFixesStr));
        }
    }

    getGame(options) {
        var fixedType = 'id';

        idsByType = this.fixIds(options.type, options.id, fixedType);
        if (typeof idsByType.types[fixedType] !== "undefined") {
            options.type = fixedType;
            options.id = idsByType.orderedFixedIds[0];
        }
        return super.getGame(options);
    }

    getHeroes(options) {
        return this.getPromiseWithFixedOptions("getHeroes", options);
    }

    getGrids(options) {
        return this.getPromiseWithFixedOptions("getGrids", options);
    }

    getPromiseWithFixedOptions(func, options) {
        return new Promise((resolve, reject) => {
            var promises = [];

            idsByType = this.fixIds(options.type, options.id, 'game');
            idOrder = options.id.split(",");

            promises.push(idsByType.orderedFixedIds);

            for (var type in idsByType.types) {
                var ids = idsByType.types[type];
                options.id = ids.join(",");
                options.type = type;
                promises.push(ids);
                switch (func) {
                    case "getHeroes":
                        promises.push(super.getHeroes(options));
                        break;
                    case "getGrids":
                        promises.push(super.getGrids(options));
                        break;
                    }
            };

            Promise.all(promises).then((res) => {
                var idOrder = res[0];
                var resultsById = {};

                for (var i = 1; i < res.length; i += 2) {
                    var currentIds = res[i];
                    var response = res[i + 1];

                    currentIds.map((id, num) => {
                        if (currentIds.length == 1)
                            resultsById[id] = { success: true, data: response };
                        else
                            resultsById[id] = response[num];
                    });
                }

                var ret = [];

                idOrder.map((id) => {
                    ret.push(resultsById[id]);
                });

                resolve(ret);
            }).catch((err) => {
                reject(err);
            });
        });
    }

    // fixOptions(options) {
    //     try {
    //         var res = this.fixIds(options.type, options.id); 
    //         options.type = "game";
    //     }
    //     catch {
    //         return options;
    //     }
    // }

    fixIds(type, ids, fixedType) {
        var res = {};
        res.types = [];
        res.orderedFixedIds = [];

        ids.split(",").forEach(id => {
            var fixedGame = undefined;
            try { fixedGame = this.localFixes[type][id] } catch {}
            var newId = id;
            var newType = type;

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

module.exports = SGDB_Localfixes;
