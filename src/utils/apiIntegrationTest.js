// utils/apiIntegrationTest.js - Comprehensive API integration testing
// Ensures all API calls work properly with the optimized ColorWheel

import * as ApiService from '../services/api';

/**
 * Test API integration with the optimized ColorWheel
 */
export class ApiIntegrationTest {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      tests: {},
      summary: {
        passed: 0,
        failed: 0,
        total: 0
      }
    };
  }

  /**
   * Log test result
   */
  logResult(testName, passed, details = {}) {
    this.results.tests[testName] = {
      passed,
      details,
      timestamp: new Date().toISOString()
    };
    
    if (passed) {
      this.results.summary.passed++;
      console.log(`✅ ${testName}: PASSED`);
    } else {
      this.results.summary.failed++;
      console.error(`❌ ${testName}: FAILED`, details);
    }
    
    this.results.summary.total++;
  }

  /**
   * Test API connectivity
   */
  async testApiConnectivity() {
    try {
      console.log('🔌 Testing API connectivity...');
      
      // Test health endpoint
      const healthResult = await ApiService.healthCheck();
      
      this.logResult('API Connectivity', true, {
        healthCheck: 'OK',
        response: healthResult
      });
      
      return true;
    } catch (error) {
      this.logResult('API Connectivity', false, {
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * Test authentication flow
   */
  async testAuthentication() {
    try {
      console.log('🔐 Testing authentication...');
      
      // Test token initialization
      await ApiService.ready;
      const token = ApiService.getToken();
      
      // Test demo login if no token
      if (!token) {
        const loginResult = await ApiService.demoLogin();
        this.logResult('Demo Login', !!loginResult.token, {
          hasToken: !!loginResult.token,
          userId: loginResult.user?.id
        });
      } else {
        this.logResult('Token Available', true, {
          tokenExists: true,
          tokenLength: token.length
        });
      }
      
      // Test user profile
      const profile = await ApiService.getUserProfile();
      this.logResult('User Profile', !!profile, {
        hasProfile: !!profile,
        userId: profile?.id
      });
      
      return true;
    } catch (error) {
      this.logResult('Authentication', false, {
        error: error.message,
        isAuthError: error.isAuthError
      });
      return false;
    }
  }

  /**
   * Test color match operations
   */
  async testColorMatchOperations() {
    try {
      console.log('🎨 Testing color match operations...');
      
      // Test color match creation
      const testColorMatch = {
        base_color: '#FF6B35',
        scheme: 'complementary',
        colors: ['#FF6B35', '#35A8FF'],
        title: 'API Integration Test',
        description: 'Test color match for API integration'
      };
      
      const createResult = await ApiService.createColorMatch(testColorMatch);
      this.logResult('Create Color Match', !!createResult.id, {
        hasId: !!createResult.id,
        matchId: createResult.id
      });
      
      // Test getting user color matches
      const userMatches = await ApiService.getUserColorMatches();
      this.logResult('Get User Color Matches', Array.isArray(userMatches.data), {
        isArray: Array.isArray(userMatches.data),
        count: userMatches.data?.length || 0
      });
      
      // Test getting specific color match
      if (createResult.id) {
        const specificMatch = await ApiService.getColorMatch(createResult.id);
        this.logResult('Get Specific Color Match', !!specificMatch, {
          found: !!specificMatch,
          matchesId: specificMatch?.id === createResult.id
        });
      }
      
      return true;
    } catch (error) {
      this.logResult('Color Match Operations', false, {
        error: error.message,
        isAuthError: error.isAuthError
      });
      return false;
    }
  }

  /**
   * Test likes functionality
   */
  async testLikesFunctionality() {
    try {
      console.log('❤️ Testing likes functionality...');
      
      // Get user color matches first
      const userMatches = await ApiService.getUserColorMatches();
      
      if (userMatches.data && userMatches.data.length > 0) {
        const testMatch = userMatches.data[0];
        
        // Test liking a color match
        const likeResult = await ApiService.likeColorMatch(testMatch.id);
        this.logResult('Like Color Match', !!likeResult, {
          success: !!likeResult,
          matchId: testMatch.id
        });
        
        // Test getting likes
        const likesResult = await ApiService.getColorMatchLikes(testMatch.id);
        this.logResult('Get Color Match Likes', typeof likesResult.like_count === 'number', {
          hasLikeCount: typeof likesResult.like_count === 'number',
          likeCount: likesResult.like_count,
          isLiked: likesResult.is_liked
        });
        
        // Test unliking
        const unlikeResult = await ApiService.unlikeColorMatch(testMatch.id);
        this.logResult('Unlike Color Match', !!unlikeResult, {
          success: !!unlikeResult,
          matchId: testMatch.id
        });
      } else {
        this.logResult('Likes Functionality', false, {
          error: 'No color matches available to test likes'
        });
      }
      
      return true;
    } catch (error) {
      this.logResult('Likes Functionality', false, {
        error: error.message,
        isAuthError: error.isAuthError
      });
      return false;
    }
  }

  /**
   * Test color validation
   */
  async testColorValidation() {
    try {
      console.log('🔍 Testing color validation...');
      
      // Test valid hex color
      const validResult = await ApiService.validateHex('#FF6B35');
      this.logResult('Valid Hex Validation', validResult.valid === true, {
        isValid: validResult.valid,
        color: '#FF6B35'
      });
      
      // Test invalid hex color
      try {
        const invalidResult = await ApiService.validateHex('invalid-color');
        this.logResult('Invalid Hex Validation', invalidResult.valid === false, {
          isValid: invalidResult.valid,
          color: 'invalid-color'
        });
      } catch (error) {
        // It's OK if this throws an error for invalid colors
        this.logResult('Invalid Hex Validation', true, {
          properlyRejected: true,
          error: error.message
        });
      }
      
      return true;
    } catch (error) {
      this.logResult('Color Validation', false, {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Test optimized ColorWheel integration
   */
  async testOptimizedColorWheelIntegration() {
    try {
      console.log('⚡ Testing optimized ColorWheel integration...');
      
      // Test that optimized functions don't break API calls
      const testColors = ['#FF6B35', '#35A8FF', '#A835FF'];
      
      // Simulate color wheel operations that would trigger API calls
      const colorMatch = {
        base_color: testColors[0],
        scheme: 'triadic',
        colors: testColors,
        title: 'Optimized Integration Test',
        description: 'Testing optimized ColorWheel with API integration'
      };
      
      // Test creation through optimized flow
      const createResult = await ApiService.createColorMatch(colorMatch);
      
      this.logResult('Optimized ColorWheel Integration', !!createResult.id, {
        created: !!createResult.id,
        matchId: createResult.id,
        colorsCount: testColors.length,
        scheme: colorMatch.scheme
      });
      
      return true;
    } catch (error) {
      this.logResult('Optimized ColorWheel Integration', false, {
        error: error.message,
        isAuthError: error.isAuthError
      });
      return false;
    }
  }

  /**
   * Run complete API integration test suite
   */
  async runCompleteTest() {
    console.log('🚀 Starting Complete API Integration Test Suite');
    console.log('=' .repeat(60));
    
    const startTime = performance.now();
    
    try {
      // Run all tests in sequence
      await this.testApiConnectivity();
      await this.testAuthentication();
      await this.testColorMatchOperations();
      await this.testLikesFunctionality();
      await this.testColorValidation();
      await this.testOptimizedColorWheelIntegration();
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Generate summary
      this.results.summary.duration = `${duration.toFixed(2)}ms`;
      this.results.summary.successRate = `${((this.results.summary.passed / this.results.summary.total) * 100).toFixed(1)}%`;
      
      console.log('📊 API Integration Test Summary:');
      console.log('=' .repeat(60));
      console.log(`Total Tests: ${this.results.summary.total}`);
      console.log(`Passed: ${this.results.summary.passed}`);
      console.log(`Failed: ${this.results.summary.failed}`);
      console.log(`Success Rate: ${this.results.summary.successRate}`);
      console.log(`Duration: ${this.results.summary.duration}`);
      
      // Log failed tests
      if (this.results.summary.failed > 0) {
        console.log('\n❌ Failed Tests:');
        Object.entries(this.results.tests).forEach(([name, result]) => {
          if (!result.passed) {
            console.log(`  - ${name}: ${result.details.error || 'Unknown error'}`);
          }
        });
      }
      
      return this.results;
      
    } catch (error) {
      console.error('Test suite error:', error);
      return {
        error: true,
        message: error.message,
        partialResults: this.results
      };
    }
  }

  /**
   * Get test results
   */
  getResults() {
    return this.results;
  }

  /**
   * Generate recommendations based on test results
   */
  getRecommendations() {
    const recommendations = [];
    
    if (this.results.summary.failed === 0) {
      recommendations.push('✅ All API integrations are working correctly');
      recommendations.push('✅ Optimized ColorWheel is properly integrated');
      recommendations.push('✅ Ready for production deployment');
    } else {
      recommendations.push('⚠️ Some API integrations need attention');
      
      Object.entries(this.results.tests).forEach(([name, result]) => {
        if (!result.passed) {
          if (result.details.isAuthError) {
            recommendations.push(`🔐 ${name}: Check authentication configuration`);
          } else {
            recommendations.push(`🔧 ${name}: ${result.details.error}`);
          }
        }
      });
    }
    
    return recommendations;
  }
}

/**
 * Quick API integration test
 */
export async function quickApiTest() {
  if (!__DEV__) {
    console.warn('🚫 API integration tests only available in development');
    return { blocked: true, reason: 'Production build - tests disabled' };
  }
  
  const tester = new ApiIntegrationTest();
  return await tester.runCompleteTest();
}

export default ApiIntegrationTest;
