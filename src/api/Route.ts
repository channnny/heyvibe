import log from 'bog';

// Defaults
const ALLOWED_VERBS: string[] = ['post', 'get'];


/**
 * "Clean up path", split by / and remove args
*/
const cleanUp = (path: string) => {
    const arr = path.split('/');
    const result = arr.map((x) => {
        if (x.length && !x.match(/{/)) return x;
        return undefined;
    }).filter((y: any) => y);
    return result;
};

/**
 * Api route handler
 */
class Route {
    /**
     * Save All routes in array
     */
    apiRoutes = [];

    /**
     * Add / register endpoints
     * check if endpoint is allowed and if it already exists
     */
    add({ method, path, handler }): void {
        const methodLow = method.toLowerCase();
        if (ALLOWED_VERBS.includes(methodLow)) {
            if (!this.apiRoutes.length) {
                this.apiRoutes.push({ method: methodLow, path, handler });
            } else {
                this.apiRoutes.map((x) => {
                    if (x.path === path && x.method === methodLow) {
                        throw new Error(`API endpoint already registerd, method: ${methodLow}, path: ${path}`);
                    } else {
                        this.apiRoutes.push({ method: methodLow, path, handler });
                    }
                    return undefined;
                });
            }
        } else {
            throw new Error(`Method not allowed, method: ${method}, path: ${path}`);
        }
    }

    /**
     * Check request if path is registerd
     * Also get all params posted and assign to request object
     */
    check({ method, path, req }) {
        log.debug('Route :: check :: ', method, path);
        
        // URL에서 쿼리 파라미터 제거
        const cleanPath = path.split('?')[0];
        
        /**
         * Get registerd endpoint, match method and path.
         */
        const [route] = this.apiRoutes.filter((x) => {
            // Clean up paths
            const routeSplitted: string[] = cleanUp(x.path);
            const reqSplitted: string[] = cleanUp(cleanPath);

            const routeUrl = routeSplitted.map((s) => `${s}/`).join('');
            const reqUrl = reqSplitted.map((r) => `${r}/`).join('');
            if (method === x.method && reqUrl.startsWith(routeUrl)) return x;
            return undefined;
        }).filter((y: any) => y);

        // Unless route not found, return error
        if (!route) return { error: true };

        // Args that we want
        const routeArgs = route.path.match(/{(.*?)}/gmi);

        // Get args from request
        const routePath = route.path.split('/');
        const reqPath = cleanPath.split('/');

        const reqArgs = reqPath.filter((x) => !routePath.includes(x));

        const args = reqArgs.map((x, index) => {
            const key = routeArgs[index];
            const keyClean = key ? key.replace(/\{|\}/gi, '') : undefined;
            if (keyClean) return { [keyClean]: x };
            return undefined;
        }).filter((y: any) => y);

        // Merge objects to one object
        const argsObject = args.reduce((r, c) => ({ ...r, ...c }), {});

        // Add args to req object
        req.params = argsObject;

        // 쿼리 파라미터 처리
        const url = new URL(req.url, `http://${req.headers.host}`);
        const queryParams: any = {};
        url.searchParams.forEach((value, key) => {
            queryParams[key] = value;
        });
        req.query = queryParams;

        // Plocka ut params from url
        const request = req;
        return { route, request };
    }
}

export default new Route();
