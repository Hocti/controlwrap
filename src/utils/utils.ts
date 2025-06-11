export function stopEvent(event: Event) {
	if (event.preventDefault != undefined) event.preventDefault();
	if (event.stopPropagation != undefined) event.stopPropagation();
}

export function inEnum(value: string, enumType: any): boolean {
	return Object.values(enumType).includes(value as any);
}

export function filterObject<T extends object, K extends keyof T>(obj: T, keys: K[]): Partial<T> {
	let filteredObj = {} as Partial<T>;
	keys.forEach((key) => {
		if (key in obj) {
			filteredObj[key] = obj[key];
		}
	});
	return filteredObj;
}

export function findKeyByValue(record: Record<string, string>, value: string): string | undefined {
	for (const [key, val] of Object.entries(record)) {
		if (val === value) {
			return key;
		}
	}
	return undefined;
}

export function clone<T extends object>(obj: T): T {
	return JSON.parse(JSON.stringify(obj));
}
