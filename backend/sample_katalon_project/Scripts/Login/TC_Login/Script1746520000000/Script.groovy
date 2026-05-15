import com.kms.katalon.core.webui.keyword.WebUiBuiltinKeywords as WebUI
import internal.GlobalVariable as GlobalVariable

'TC_Login: Sample login test case'

WebUI.openBrowser('')
WebUI.navigateToUrl('https://example.com')

// Verify the login button is present
WebUI.verifyElementPresent(findTestObject('LoginPage/btn_Login'), 10)
WebUI.takeScreenshot()

WebUI.closeBrowser()
