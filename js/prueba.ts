interface Usuario {
	nombre: string;
	edad: number;
}

const usuario: Usuario = { nombre: 'Ana', edad: 25 };

/**
 *
 * @param u
 */
const sayHi = (u: Usuario): void => {
	const mensaje = `Hola, ${u.nombre}`;
	console.log(mensaje);
};

sayHi(usuario);

/**
 *
 * @param u
 */
const sayBye = (u: Usuario): void => {
	console.log(`Adiós ${u.nombre}`);
	const hola = `Hola ${u.nombre}`;

	console.warn(hola);
};

sayBye(usuario);

/**
 * sadasdas
 */
class Persona {
	/**
	 *
	 * @param nombre
	 * @param edad
	 */
	constructor(
		public nombre: string,
		private edad: number,
	) {}

	/**
	 * Saluda con el nombre.
	 * @returns El saludo personalizado.
	 */
	saludar(): string {
		return `Hola, soy ${this.nombre}`;
	}

	/**
	 * Obtiene la edad actual.
	 * @returns La edad como número.
	 */
	getEdad(): number {
		return this.edad;
	}
}
