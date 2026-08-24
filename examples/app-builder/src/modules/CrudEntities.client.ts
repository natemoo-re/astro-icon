/* eslint-disable no-param-reassign */

import { endpointsToOperations } from '../pages/api/[...entity].js';

type Endpoint = keyof typeof endpointsToOperations;

async function fetchData<Selected extends Endpoint>(endpoint: Selected) {
	const apiEndpoint = `${import.meta.env.BASE_URL}api/${endpoint}`;

	console.info(`Fetching ${apiEndpoint}…`);
	return fetch(apiEndpoint)
		.then(
			(r) =>
				r.json() as unknown as Promise<
					ReturnType<(typeof endpointsToOperations)[Selected]>
				>,
		)
		.catch((e) => {
			console.error(e);
			throw Error('Invalid API data!');
		});
}

export class CrudEntities extends HTMLElement {
	#body = this.querySelector('tbody')!;

	#rows = this.#body.querySelectorAll('tr')!;

	#refreshButton = this.querySelector('[data-refresh]');

	type: Endpoint | undefined;

	constructor() {
		super();
		const type = this.getAttribute('type');

		if (
			Object.keys(endpointsToOperations).find((endpoint) => endpoint === type)
		)
			this.type = type as Endpoint;
		else throw Error('Wrong CRUD type!');

		this.#refreshButton?.addEventListener('click', () => {
			this.update().catch(() => undefined);
		});
	}

	/**
	 * Fetch new content from API and update DOM text accordingly
	 */
	async update() {
		if (!this.type) return;

		const newData = await fetchData(this.type);

		this.#rows.forEach((row, index) =>
			row.querySelectorAll('data').forEach((binding) => {
				const valKey = binding.value;
				const rowData = newData[index];
				if (!rowData) return;
				if (!(valKey in rowData)) return;

				binding.innerText = rowData[valKey as keyof typeof rowData].toString();
			}),
		);

		console.log('New data received!', newData);
	}
}

export const tagName = 'entities-crud';
declare global {
	interface HTMLElementTagNameMap {
		[tagName]: CrudEntities;
	}
}

customElements.define(tagName, CrudEntities);
