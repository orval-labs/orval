"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.customInstance = exports.AXIOS_INSTANCE = void 0;
var axios_1 = __importDefault(require("axios"));
exports.AXIOS_INSTANCE = axios_1.default.create({ baseURL: '' });
var customInstance = function (config) {
    var source = axios_1.default.CancelToken.source();
    var promise = (0, exports.AXIOS_INSTANCE)(__assign(__assign({}, config), { cancelToken: source.token })).then(function (_a) {
        var data = _a.data;
        return data;
    });
    // @ts-ignore
    promise.cancel = function () {
        source.cancel('Query was cancelled by React Query');
    };
    return promise;
};
exports.customInstance = customInstance;
exports.default = exports.customInstance;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3VzdG9tLWluc3RhbmNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY3VzdG9tLWluc3RhbmNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsZ0RBQWtEO0FBRXJDLFFBQUEsY0FBYyxHQUFHLGVBQUssQ0FBQyxNQUFNLENBQUMsRUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztBQUVyRCxJQUFNLGNBQWMsR0FBRyxVQUFJLE1BQTBCO0lBQzFELElBQU0sTUFBTSxHQUFHLGVBQUssQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUM7SUFDMUMsSUFBTSxPQUFPLEdBQUcsSUFBQSxzQkFBYyx3QkFBTSxNQUFNLEtBQUUsV0FBVyxFQUFFLE1BQU0sQ0FBQyxLQUFLLElBQUcsQ0FBQyxJQUFJLENBQzNFLFVBQUMsRUFBUTtZQUFOLElBQUksVUFBQTtRQUFPLE9BQUEsSUFBSTtJQUFKLENBQUksQ0FDbkIsQ0FBQztJQUVGLGFBQWE7SUFDYixPQUFPLENBQUMsTUFBTSxHQUFHO1FBQ2YsTUFBTSxDQUFDLE1BQU0sQ0FBQyxvQ0FBb0MsQ0FBQyxDQUFDO0lBQ3RELENBQUMsQ0FBQztJQUVGLE9BQU8sT0FBTyxDQUFDO0FBQ2pCLENBQUMsQ0FBQztBQVpXLFFBQUEsY0FBYyxrQkFZekI7QUFFRixrQkFBZSxzQkFBYyxDQUFDIn0=