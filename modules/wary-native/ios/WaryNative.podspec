Pod::Spec.new do |s|
  s.name           = 'WaryNative'
  s.version        = '1.0.0'
  s.summary        = 'Wary native helpers'
  s.description    = 'App-group file writes, Call Directory reload/status, passcode check'
  s.author         = 'Wary'
  s.homepage       = 'https://github.com/brendanmccormack2025-sketch/LENS'
  s.license        = 'MIT'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'CallKit', 'LocalAuthentication'
  s.source_files   = '**/*.{h,m,swift}'
end
