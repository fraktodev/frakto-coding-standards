/**
 * kjhakjsh dkjashd kajshd.
 * @param {string}   [nombre=Danny] - Nombre de la persona a saludar.
 * @param {number[]} [time=[59,20]] - Hola crayola.
 * @param {any}      param          - Descripción del parámetro.
 * @returns {string}
 */
const sinDocblock2 = (nombre = 'Danny', time = [59, 20], param) => {
	try {
		return `Hola, ${nombre} son las ${time} ${param}`;
	} catch (error) {
		return new Error('Error al saludar');
	}
};

console.log(sinDocblock2('Juan', '10:00 AM'));
/**
 * This is class alksd ljasl dkjaslkd j laskjd lkasjd lkasjd laksjdl akjsdl akjsdlkajsl
 * alksjd laksj dlkasj dlkasjd lkasjd lkajs ldkjaslkdjas lkjdaslk jasdlkjasd lkajsd
 * klaj sdklajs asd sadsa lkja.
 */
class Saludos {
	/**
	 * asd kaskldj kaljdslaksj.
	 * @param {number} num - A number to append to the greeting message.
	 * @returns {void}
	 */
	constructor(num) {
		this.mensaje = 'Hola' + num;
	}

	/**
	 * Returns the greeting message stored in the instance.
	 * @returns {string}
	 */
	saludar() {
		return this.mensaje;
	}
}
