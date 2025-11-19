import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { safeAsyncStorage } from '../utils/safeAsyncStorage';
import ApiService from '../services/safeApiService';
import { safeStorage } from '../utils/safeStorage';
import useDebounce from '../hooks/useDebounce';
import { safeApiCall, apiPatterns } from '../utils/apiHelpers';

const SIGNUP_STEPS = {
  EMAIL: 'email',
  PASSWORD: 'password',
  USERNAME: 'username',
  LOCATION: 'location',
  BIRTHDAY: 'birthday',
  GENDER: 'gender',
  COMPLETE: 'complete'
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const COUNTRIES = [
  'United States', 'Canada', 'United Kingdom', 'Australia', 'Germany', 
  'France', 'Italy', 'Spain', 'Japan', 'South Korea', 'Brazil', 'Mexico',
  'India', 'China', 'Other'
];

export default function SignUpScreen({ onSignUpComplete, onBackToLogin }) {
  const [currentStep, setCurrentStep] = useState(SIGNUP_STEPS.EMAIL);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    location: '',
    birthday: { month: '', day: '', year: '' },
    gender: ''
  });
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState({ isValid: null, message: '' });
  
  // ✅ SAFER: Track component mount status to prevent state updates on unmounted component
  const isMountedRef = useRef(true);
  
  // Debounce username for availability checks
  const debouncedUsername = useDebounce(formData.username, 400);

  // Mock existing usernames for validation (in real app, this would be from backend)
  const existingUsernames = ['fashionlover', 'colormaster', 'styleicon', 'trendsettr', 'artlover'];

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateUsername = async (username) => {
    const normalizedUsername = username.trim().toLowerCase();
    
    // Enhanced username validation with regex
    if (!/^[a-z0-9._-]{3,20}$/.test(normalizedUsername)) {
      return {
        isValid: false,
        message: 'Use 3–20 chars: letters, numbers, dot, underscore, hyphen.'
      };
    }

    // Use apiPatterns for username validation with fallback
    const result = await apiPatterns.checkUsernameAvailability(normalizedUsername);

    if (result.success) {
      return {
        isValid: result.data.available,
        message: result.data.available ? 'Username available!' : 'Username already taken'
      };
    } else {
      console.error('Username validation error:', result.error);
      // Fallback to local validation if API fails
      const isUnique = !existingUsernames.includes(normalizedUsername);
      return {
        isValid: isUnique,
        message: isUnique ? 'Username available (offline check)' : 'Username already taken'
      };
    }
  };

  // Birthday validation helpers
  const isValidDate = (year, month, day) => {
    const monthIdx = MONTHS.indexOf(month);
    if (monthIdx < 0) return false;
    const dt = new Date(Number(year), monthIdx, Number(day));
    return dt.getFullYear() == year && dt.getMonth() == monthIdx && dt.getDate() == Number(day);
  };

  const isOldEnough = (year, month, day, minYears = 13) => {
    const monthIdx = MONTHS.indexOf(month);
    const dob = new Date(Number(year), monthIdx, Number(day));
    const today = new Date();
    const min = new Date(today.getFullYear() - minYears, today.getMonth(), today.getDate());
    return dob <= min;
  };

  // ✅ SAFER: Cleanup effect to prevent state updates on unmounted component
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Debounced username validation effect
  useEffect(() => {
    if (debouncedUsername && debouncedUsername.length >= 3) {
      validateUsername(debouncedUsername).then(result => {
        // ✅ SAFER: Only update state if component is still mounted
        if (isMountedRef.current) {
          setUsernameStatus(result);
        }
      });
    } else if (debouncedUsername && debouncedUsername.length > 0) {
      if (isMountedRef.current) {
        setUsernameStatus({ isValid: false, message: 'Username too short' });
      }
    } else {
      if (isMountedRef.current) {
        setUsernameStatus({ isValid: null, message: '' });
      }
    }
  }, [debouncedUsername]);

  // Step validation logic
  const isStepValid = () => {
    switch (currentStep) {
      case SIGNUP_STEPS.EMAIL:
        const email = formData.email.trim().toLowerCase();
        return email && validateEmail(email);
        
      case SIGNUP_STEPS.PASSWORD:
        return formData.password && formData.password.length >= 6;
        
      case SIGNUP_STEPS.USERNAME:
        const username = formData.username.trim().toLowerCase();
        return username && 
               /^[a-z0-9._-]{3,20}$/.test(username) && 
               usernameStatus.isValid === true;
        
      case SIGNUP_STEPS.LOCATION:
        return formData.location && formData.location.length > 0;
        
      case SIGNUP_STEPS.BIRTHDAY:
        const { month, day, year } = formData.birthday;
        return month && day && year && 
               isValidDate(year, month, day) && 
               isOldEnough(year, month, day);
        
      case SIGNUP_STEPS.GENDER:
        return formData.gender && formData.gender.length > 0;
        
      case SIGNUP_STEPS.COMPLETE:
        return true;
        
      default:
        return false;
    }
  };

  const handleNext = async () => {
    // Don't proceed if step is invalid (button should be disabled)
    if (!isStepValid()) return;
    
    if (isMountedRef.current) {
      setLoading(true);
    }
    
    try {
      switch (currentStep) {
        case SIGNUP_STEPS.EMAIL:
          const email = formData.email.trim().toLowerCase();
          if (isMountedRef.current) {
            setFormData(prev => ({ ...prev, email }));
            setCurrentStep(SIGNUP_STEPS.PASSWORD);
          }
          break;

        case SIGNUP_STEPS.PASSWORD:
          if (isMountedRef.current) {
            setCurrentStep(SIGNUP_STEPS.USERNAME);
          }
          break;

        case SIGNUP_STEPS.USERNAME:
          const username = formData.username.trim().toLowerCase();
          if (isMountedRef.current) {
            setFormData(prev => ({ ...prev, username }));
            setCurrentStep(SIGNUP_STEPS.LOCATION);
          }
          break;

        case SIGNUP_STEPS.LOCATION:
          if (isMountedRef.current) {
            setCurrentStep(SIGNUP_STEPS.BIRTHDAY);
          }
          break;

        case SIGNUP_STEPS.BIRTHDAY:
          if (isMountedRef.current) {
            setCurrentStep(SIGNUP_STEPS.GENDER);
          }
          break;

        case SIGNUP_STEPS.GENDER:
          await completeSignUp();
          break;

        default:
          break;
      }
    } catch (error) {
      console.error('Navigation error:', error);
      // Only show error for actual failures, not validation issues
      if (isMountedRef.current) {
        Alert.alert('Error', 'Something went wrong. Please try again.');
      }
    }
    
    if (isMountedRef.current) {
      setLoading(false);
    }
  };

  const completeSignUp = async () => {
    // Register user with backend API using safeApiCall
    const registrationData = {
      email: formData.email,
      password: formData.password,
      username: formData.username,
      location: formData.location,
      birthday: formData.birthday,
      gender: formData.gender
    };

    const result = await apiPatterns.registerUser(registrationData);

    if (result.success && result.data.success && result.data.user) {
      try {
        // Store user data and token securely
        await safeAsyncStorage.setItem('userData', JSON.stringify(result.data.user));
        await safeAsyncStorage.setItem('isLoggedIn', 'true');
        
        if (result.data.token) {
          await safeStorage.setToken(result.data.token);
          // Set token in ApiService for authenticated requests
          ApiService.setToken(result.data.token);
        }  
        
        if (isMountedRef.current) {
          setCurrentStep(SIGNUP_STEPS.COMPLETE);
        }
        
        // Auto-complete after showing success with safer callback handling
        setTimeout(() => {
          if (isMountedRef.current && onSignUpComplete && typeof onSignUpComplete === 'function') {
            try {
              onSignUpComplete(result.data.user);
            } catch (callbackError) {
              console.error('onSignUpComplete callback error:', callbackError);
            }
          }
        }, 2000);
        
      } catch (storageError) {
        console.error('Storage error during signup:', storageError);
        Alert.alert('Registration Error', 'Account created but failed to save locally. Please try logging in.');
      }
    } else if (result.success) {
      // API call succeeded but registration failed
      Alert.alert('Registration Failed', result.data.message || 'Failed to create account');
    }
    // If result.success is false, safeApiCall already showed the error alert
  };

  const handleBack = () => {
    switch (currentStep) {
      case SIGNUP_STEPS.EMAIL:
        if (onBackToLogin && typeof onBackToLogin === 'function') {
          try {
            onBackToLogin();
          } catch (callbackError) {
            console.error('onBackToLogin callback error:', callbackError);
          }
        }
        break;
      case SIGNUP_STEPS.PASSWORD:
        if (isMountedRef.current) {
          setCurrentStep(SIGNUP_STEPS.EMAIL);
        }
        break;
      case SIGNUP_STEPS.USERNAME:
        if (isMountedRef.current) {
          setCurrentStep(SIGNUP_STEPS.PASSWORD);
        }
        break;
      case SIGNUP_STEPS.LOCATION:
        if (isMountedRef.current) {
          setCurrentStep(SIGNUP_STEPS.USERNAME);
        }
        break;
      case SIGNUP_STEPS.BIRTHDAY:
        if (isMountedRef.current) {
          setCurrentStep(SIGNUP_STEPS.LOCATION);
        }
        break;
      case SIGNUP_STEPS.GENDER:
        if (isMountedRef.current) {
          setCurrentStep(SIGNUP_STEPS.BIRTHDAY);
        }
        break;
    }
  };

  const getStepProgress = () => {
    const steps = Object.values(SIGNUP_STEPS);
    const currentIndex = steps.indexOf(currentStep);
    return currentIndex + 1;
  };

  const renderProgressDots = () => {
    const totalSteps = 6; // Email, Password, Username, Location, Birthday, Gender
    const currentStepNumber = getStepProgress();
    
    return (
      <View style={styles.progressContainer}>
        {Array.from({ length: totalSteps }, (_, index) => (
          <View
            key={index}
            style={[
              styles.progressDot,
              index < currentStepNumber ? styles.progressDotActive : styles.progressDotInactive
            ]}
          />
        ))}
      </View>
    );
  };

  const renderEmailStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>What's your email?</Text>
      <TextInput
        style={styles.input}
        value={formData.email}
        onChangeText={(text) => setFormData({ ...formData, email: text })}
        placeholder="Enter your email"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
    </View>
  );

  const renderPasswordStep = () => {
    const getPasswordStrength = () => {
      const password = formData.password;
      if (!password) return { strength: 0, text: '', color: '#ddd' };
      if (password.length < 6) return { strength: 1, text: 'Too short', color: '#dc3545' };
      if (password.length < 8) return { strength: 2, text: 'Weak', color: '#fd7e14' };
      if (password.length < 12) return { strength: 3, text: 'Good', color: '#ffc107' };
      return { strength: 4, text: 'Strong', color: '#28a745' };
    };

    const passwordStrength = getPasswordStrength();

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>Create a password</Text>
        <Text style={styles.stepSubtitle}>
          Choose a strong password to keep your account secure
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Enter password"
          value={formData.password}
          onChangeText={(text) => setFormData({...formData, password: text})}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />
        {formData.password.length > 0 && (
          <View style={styles.passwordStrengthContainer}>
            <View style={styles.passwordStrengthBar}>
              {[1, 2, 3, 4].map((level) => (
                <View
                  key={level}
                  style={[
                    styles.passwordStrengthSegment,
                    { backgroundColor: level <= passwordStrength.strength ? passwordStrength.color : '#e9ecef' }
                  ]}
                />
              ))}
            </View>
            <Text style={[styles.passwordStrengthText, { color: passwordStrength.color }]}>
              {passwordStrength.text}
            </Text>
          </View>
        )}
        <Text style={styles.helperText}>
          Password must be at least 6 characters long
        </Text>
      </View>
    );
  };

  const renderUsernameStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Choose a username</Text>
      <Text style={styles.stepSubtitle}>
        This is how others will find you on the platform
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Enter username"
        value={formData.username}
        onChangeText={(text) => setFormData({...formData, username: text})}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {usernameStatus.message ? (
        <Text style={[
          styles.usernameStatus,
          usernameStatus.isValid === true ? styles.usernameStatusValid : 
          usernameStatus.isValid === false ? styles.usernameStatusInvalid : styles.usernameStatusNeutral
        ]}>
          {usernameStatus.message}
        </Text>
      ) : null}
      <Text style={styles.helperText}>
        Use 3–20 characters: letters, numbers, dots, underscores, or hyphens
      </Text>
    </View>
  );

  const renderLocationStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Where do you live?</Text>
      <Text style={styles.stepSubtitle}>
        This helps us find you more relevant content. We won't show it on your profile.
      </Text>
      <ScrollView style={styles.optionsList}>
        {COUNTRIES.map((country) => (
          <TouchableOpacity
            key={country}
            style={[
              styles.optionButton,
              formData.location === country && styles.optionButtonSelected
            ]}
            onPress={() => setFormData({ ...formData, location: country })}
          >
            <Text style={[
              styles.optionText,
              formData.location === country && styles.optionTextSelected
            ]}>
              {country}
            </Text>
            {formData.location === country && (
              <Text style={styles.checkmark}>✓</Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderBirthdayStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Hey {formData.username} ✏️</Text>
      <Text style={styles.stepTitle}>Enter your birthdate</Text>
      <Text style={styles.stepSubtitle}>
        Knowing your age helps keep Pinterest safe for everyone. It won't be visible to others.
      </Text>
      <Text style={styles.helperText}>
        Use your own birthdate, even if this is a business account
      </Text>
      
      <View style={styles.birthdayContainer}>
        <ScrollView style={styles.birthdayPicker}>
          {MONTHS.map((month, index) => (
            <TouchableOpacity
              key={month}
              style={[
                styles.birthdayOption,
                formData.birthday.month === month && styles.birthdayOptionSelected
              ]}
              onPress={() => setFormData({
                ...formData,
                birthday: { ...formData.birthday, month }
              })}
            >
              <Text style={[
                styles.birthdayText,
                formData.birthday.month === month && styles.birthdayTextSelected
              ]}>
                {month}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView style={styles.birthdayPicker}>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
            <TouchableOpacity
              key={day}
              style={[
                styles.birthdayOption,
                formData.birthday.day === day.toString() && styles.birthdayOptionSelected
              ]}
              onPress={() => setFormData({
                ...formData,
                birthday: { ...formData.birthday, day: day.toString() }
              })}
            >
              <Text style={[
                styles.birthdayText,
                formData.birthday.day === day.toString() && styles.birthdayTextSelected
              ]}>
                {day}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView style={styles.birthdayPicker}>
          {Array.from({ length: 50 }, (_, i) => 2024 - i).map((year) => (
            <TouchableOpacity
              key={year}
              style={[
                styles.birthdayOption,
                formData.birthday.year === year.toString() && styles.birthdayOptionSelected
              ]}
              onPress={() => setFormData({
                ...formData,
                birthday: { ...formData.birthday, year: year.toString() }
              })}
            >
              <Text style={[
                styles.birthdayText,
                formData.birthday.year === year.toString() && styles.birthdayTextSelected
              ]}>
                {year}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );

  const renderGenderStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>What's your gender?</Text>
      <Text style={styles.stepSubtitle}>
        This will influence the content you see. It won't be visible to others.
      </Text>
      
      <View style={styles.genderContainer}>
        {['Female', 'Male', 'Specify another'].map((gender) => (
          <TouchableOpacity
            key={gender}
            style={[
              styles.genderButton,
              formData.gender === gender && styles.genderButtonSelected
            ]}
            onPress={() => setFormData({ ...formData, gender })}
          >
            <Text style={[
              styles.genderText,
              formData.gender === gender && styles.genderTextSelected
            ]}>
              {gender}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderCompleteStep = () => (
    <View style={styles.completeContainer}>
      <Text style={styles.completeIcon}>🎉</Text>
      <Text style={styles.completeTitle}>Welcome to Fashion Color Wheel!</Text>
      <Text style={styles.completeSubtitle}>
        Your account has been created successfully. Get ready to discover amazing color combinations!
      </Text>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case SIGNUP_STEPS.EMAIL:
        return renderEmailStep();
      case SIGNUP_STEPS.PASSWORD:
        return renderPasswordStep();
      case SIGNUP_STEPS.USERNAME:
        return renderUsernameStep();
      case SIGNUP_STEPS.LOCATION:
        return renderLocationStep();
      case SIGNUP_STEPS.BIRTHDAY:
        return renderBirthdayStep();
      case SIGNUP_STEPS.GENDER:
        return renderGenderStep();
      case SIGNUP_STEPS.COMPLETE:
        return renderCompleteStep();
      default:
        return renderEmailStep();
    }
  };

  if (currentStep === SIGNUP_STEPS.COMPLETE) {
    return (
      <View style={styles.container}>
        {renderCompleteStep()}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        {renderProgressDots()}
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderCurrentStep()}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.nextButton,
            (!isStepValid() || loading) && styles.nextButtonDisabled
          ]}
          onPress={handleNext}
          disabled={!isStepValid() || loading}
        >
          <Text style={styles.nextButtonText}>
            {loading ? 'Loading...' : 
             currentStep === SIGNUP_STEPS.GENDER ? 'Complete' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#333',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  progressDotActive: {
    backgroundColor: '#333',
  },
  progressDotInactive: {
    backgroundColor: '#ddd',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stepContainer: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 400,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'left',
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    lineHeight: 22,
  },
  helperText: {
    fontSize: 14,
    color: '#999',
    marginTop: 10,
    lineHeight: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 15,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    marginTop: 20,
  },
  optionsList: {
    maxHeight: 300,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 25,
    backgroundColor: '#f9f9f9',
    marginBottom: 10,
  },
  optionButtonSelected: {
    backgroundColor: '#333',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
  },
  optionTextSelected: {
    color: '#fff',
  },
  checkmark: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
  },
  birthdayContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  birthdayPicker: {
    flex: 1,
    maxHeight: 200,
    marginHorizontal: 5,
    backgroundColor: '#f9f9f9',
    borderRadius: 15,
  },
  birthdayOption: {
    paddingVertical: 15,
    paddingHorizontal: 15,
    alignItems: 'center',
  },
  birthdayOptionSelected: {
    backgroundColor: '#333',
  },
  birthdayText: {
    fontSize: 16,
    color: '#333',
  },
  birthdayTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  genderContainer: {
    marginTop: 30,
  },
  genderButton: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 25,
    backgroundColor: '#f9f9f9',
    marginBottom: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  genderButtonSelected: {
    backgroundColor: '#333',
    borderColor: '#333',
  },
  genderText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  genderTextSelected: {
    color: '#fff',
  },
  completeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  completeIcon: {
    fontSize: 80,
    marginBottom: 30,
  },
  completeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 15,
  },
  completeSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 20,
  },
  nextButton: {
    backgroundColor: '#e60023',
    paddingVertical: 18,
    borderRadius: 25,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#ccc',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  usernameStatus: {
    fontSize: 14,
    marginTop: 8,
    marginHorizontal: 20,
    fontWeight: '500',
  },
  usernameStatusValid: {
    color: '#28a745',
  },
  usernameStatusInvalid: {
    color: '#dc3545',
  },
  usernameStatusNeutral: {
    color: '#6c757d',
  },
  passwordStrengthContainer: {
    marginTop: 12,
    marginHorizontal: 20,
  },
  passwordStrengthBar: {
    flexDirection: 'row',
    height: 4,
    backgroundColor: '#e9ecef',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  passwordStrengthSegment: {
    flex: 1,
    marginRight: 2,
    borderRadius: 1,
  },
  passwordStrengthText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
});
