import type { APIRoute } from 'astro';
import * as operations from '../../services/index.js';

/* Map REST API endpoints to internal operations
  (GETs only for illustration purpose) */
export const endpointsToOperations = {
	users: operations.getUsers,
};

function parseTypeParam(endpoint: string | undefined) {
	if (!endpoint || !(endpoint in endpointsToOperations)) return undefined;
	return endpoint as keyof typeof endpointsToOperations;
}

/* Controllers */

export const GET: APIRoute = ({ params /* , request */ }) => {
	const operationName = parseTypeParam(params.entity);

	if (!operationName) return new Response('404', { status: 404 });

	const body = endpointsToOperations[operationName]();

	return new Response(JSON.stringify(body), {
		status: 200,
		headers: {
			'Content-Type': 'application/json',
		},
	});
};
