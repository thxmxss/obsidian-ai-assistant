import { App, PluginSettingTab, Setting, Notice, Modal, requestUrl } from 'obsidian';

import MyPlugin from './main';
import { DEFAULT_SETTINGS } from './main';

import { Groq } from 'groq';

const manifest = require('./manifest.json');
const languages = require('./languages.json');

let ai_models : Record<string, string> = {};


export function openSettings(plugin: MyPlugin) {
	const setting = (plugin.app as any).setting;
	setting.open();
	setting.openTabById(manifest.id);
}


// Settings Tabs

export class MainSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		containerEl.empty();
		containerEl.createEl("h3", { text: "AI-Assistant" })

		new Setting(containerEl)
			.setName('Groq API Key')
			.addButton(button => button
				.setButtonText('Update Key')
				.onClick(() => {
					new ApiKeyModal(this.app, this.plugin).open();
				})
			);
		

		new Setting(containerEl)
			.setName('Model')
			.setDesc('Select the LLM model to use')
			.addDropdown(dropdown => dropdown
				.addOptions(ai_models)
				.setValue(this.plugin.settings.llm_model)
				.onChange(async (value) => {
					this.plugin.settings.llm_model = value;
					await this.plugin.saveSettings();
				})
			);
			


		//const Definer = new Groq(this.plugin, this.plugin.settings.instruct_define)

		new Setting(containerEl)
			.setName('Temperature')
			.setDesc('Temperature for AI-Model')
			.addSlider(slider => slider
				.setValue(this.plugin.settings.temperature)
				.setLimits(0, 2, 0.1)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.temperature = value;
					await this.plugin.saveSettings();
					
				})
			)
			// .addButton(button => button
			// 	.setTooltip("Explain")
			// 	.setIcon("info")
			// 	.onClick(() => {
			// 		Definer.show("Define temperature for AI-Model. Explain the range 0-2. Answer simple and short")
			// 	})
			// )



		
		
		new Setting(containerEl)
			.setName('Instructions')
			.addButton(button => button
				.setButtonText('Change Instructions')
				.onClick(() => {
					new ApiInstructModal(this.app, this.plugin).open();
				})
			);
	}
}



export class KeylessSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		containerEl.createEl("h3", { text: "AI-Assistant" })
		containerEl.createEl("p", { text: "To display avaliable LLM-models, please enter the API key. You can get the API key from the " }).createEl("a", { text: "Groq website", href: "https://console.groq.com/keys" });

		new Setting(containerEl)
			.setName('Groq API Key')
			.addButton(button => button
				.setButtonText('Enter Key')
				.onClick(() => {
					new ApiKeyModal(this.app, this.plugin).open();
				})
			);
	
	}
}



// Settings Modal

export class ApiKeyModal extends Modal {
    result: string;
    plugin: MyPlugin;

    constructor(app: App, plugin: MyPlugin) {
    super(app);
    this.plugin = plugin;
    }

    async onOpen() {
        const { contentEl } = this;

        contentEl.createEl("h3", { text: "Enter Groq API-Key" })
        contentEl.createEl("p", { text: "You can get the API key from the " }).createEl("a", { text: "Groq website", href: "https://console.groq.com/keys" });
        
        this.result = this.plugin.settings.groq_key

        new Setting(contentEl)
        
        .setName("API Key")
		.setClass("api_key_input")
        .addText((text) =>
            text.setValue(this.result)
                .onChange((value) => {
                    this.result = value
                }));

        new Setting(contentEl)
            .addButton((btn) =>
                btn
                .setButtonText("Cancel")
                .onClick(() => {
                    this.close();
                }))
            .addButton((btn) =>
                btn
                .setButtonText("Submit")
                .setCta()
                .onClick(async() => {
                    if (this.result == "" || this.result.length < 20) {
                        new Notice("Invalid API Key")
                        return
                    }

                    if (!await updateAvalibaleModels(this.plugin, this.result)){
                        new Notice("Unauthorized API Key")
                        return
                    }
                    this.plugin.settings.groq_key = this.result;
                    await this.plugin.saveSettings();
                    this.close();
                    new Notice("Reloading Plugin")
                    this.plugin.unload()
                    this.plugin.load()
                }))
            
    }

    onClose() {
		let { contentEl } = this;
		contentEl.empty();
    }
}



export class ApiInstructModal extends Modal {
    result: string;
    plugin: MyPlugin;

    constructor(app: App, plugin: MyPlugin) {
		super(app);
		this.plugin = plugin;
    }

    async onOpen() {
        const { contentEl } = this;

		let settings = this.plugin.settings
        contentEl.createEl("h3", { text: "LLM-System-Instructions" })
		contentEl.createEl("p", { text: "System-Instruction for different LLM-tasks" })


		new Setting(contentEl)
			.setName("General Instructions")
			.setClass("instruct_input")
			.addTextArea((text) =>
				text.setValue(settings.instruct_general)
					.setDisabled(true)
					.onChange((value) => {
						settings.instruct_general = value
					}));

		new Setting(contentEl)
			.setName('Language')
			.setDesc('Select preferred output language')
			.addDropdown(dropdown => dropdown
				.addOptions(languages)
				.setValue(Object.keys(languages).find(key => languages[key] === this.plugin.settings.language) || "")
				.onChange(async (value) => {
					this.plugin.settings.language = languages[value];
					await this.plugin.saveSettings();
				})
			);
        
        new Setting(contentEl)
			.setName("Summary Instructions")
			.setClass("instruct_input")
			.addTextArea((text) =>
				text.setValue(settings.instruct_summary)
					.onChange((value) => {
						settings.instruct_summary = value
					}));

		new Setting(contentEl)
			.setName("Keypoint Instructions")
			.setClass("instruct_input")
			.addTextArea((text) =>
				text.setValue(settings.instruct_keypoint)
					.onChange((value) => {
						settings.instruct_keypoint = value
					}));

		new Setting(contentEl)
			.setName("Define Instructions")
			.setClass("instruct_input")
			.addTextArea((text) =>
				text.setValue(settings.instruct_define)
					.onChange((value) => {
						settings.instruct_define = value
					}));



        new Setting(contentEl)
			.addButton((btn) =>
				btn
				.setButtonText("Cancel")
				.onClick(() => {
					this.close();
				}))
			.addButton((btn) =>
				btn
				.setButtonText("Restore Defaults")
				.setWarning()
				.onClick(() => {
					if (!confirm("Are you sure you want to restore default settings?")) {
						return
					}
					settings.instruct_summary = DEFAULT_SETTINGS.instruct_summary
					settings.instruct_keypoint = DEFAULT_SETTINGS.instruct_keypoint
					settings.instruct_define = DEFAULT_SETTINGS.instruct_define
					settings.instruct_general = DEFAULT_SETTINGS.instruct_general
					this.close();
					this.open();
				}))

            .addButton((btn) =>
                btn
                .setButtonText("Submit")
                .setCta()
                .onClick(async() => {
					await this.plugin.saveSettings();
					this.close();
                }))
            
    }

    onClose() {
    let { contentEl } = this;
    contentEl.empty();
    }
}





// Status Bar
let statusBarItem: HTMLElement;
export function setStatusBar(plugin: MyPlugin) {
	if (!statusBarItem){
		statusBarItem = plugin.addStatusBarItem();
	}
	statusBarItem.setText(`${plugin.settings.llm_model} (${plugin.settings.temperature})`);
	statusBarItem.addEventListener("click", evt => {
		openSettings(this);
	});

}




// Additional Functions

export async function updateAvalibaleModels(plugin: MyPlugin, groq_key?: string) {

    try{
        console.log("Updating Avaliable Models")
        groq_key = groq_key || plugin.settings.groq_key
        if (groq_key === "") {
            throw new Error("No API key provided")
        }

        const headers : Record<string, string> = {
            "Authorization": "Bearer " + groq_key,
            "Content-Type": "application/json"
        }

        let response = await requestUrl({
            url: "https://api.groq.com/openai/v1/models",
            method: "GET",
            headers: headers
        })

        for (let model of JSON.parse(response.text).data) {
            ai_models[model.id] = model.id
        }

        if(plugin.settings.llm_model == "") {
            plugin.settings.llm_model = ai_models["llama3-8b-8192"] || Object.keys(ai_models)[0]
        }
        
        return true

        
    } catch (e) {
        console.log(e.message)
        return false
    }
    
}